console.log("start")
// import * as Papa from "./papaparse.min.js"
declare var Chart: any //Declare the Chart type invoked with script in HTML
//Typescript definitions
interface Row {
  gender: string; forecast_date: string;
  playin_flag: boolean;
  rd_win: Array<number>;
  results_to: number; team_alive: boolean;
  team_id: number; team_name: string; team_rating: number; team_region: string; team_seed: string; team_slot: number;
}
type SparseBracket = Array<Array<number>>

function csvToArray(str: string, delimiter: string = ",") {
  //Take csv as a string and convert to array of Objects, convert numbers to numbers
  //Based on a stack overflow answer
  const headers = str.slice(0, str.indexOf("\n")).split(delimiter);
  const rows = str.slice(str.indexOf("\n") + 1).split("\n").slice(0, -1); //Ignore the final \n that closes the file
  // Map the rows
  const arr: Array<Row> = rows.map(row => {
    const values = row.split(delimiter);
    let object: Row = {
      gender: values[0], forecast_date: values[1], playin_flag: !!values[2],
      rd_win: values.slice(3, 10).map(x => Number(x)),
      results_to: Number(values[10]) - 1, team_alive: !!values[11],
      team_id: Number(values[12]), team_name: values[13], team_rating: Number(values[14]), team_region: values[15], team_seed: values[16], team_slot: Number(values[17]),
    }
    return object;
  });
  return arr; // return the array
}

class State {
  date: string
  team_id: Map<number, Row>
  team_slot: Map<number, Row>
  constructor(date: string) {
    //Save the state of the tournament in a useable format for a given date
    //CSV must be cleaned in advance, such that there is only 1 instance of each team & each rank provided
    this.date = date
    this.team_id = new Map()
    this.team_slot = new Map()
  }
  add_row(row: Row) {
    this.team_id[row.team_id] = row
    this.team_slot[row.team_slot] = row
    //Cleanup rows that are part of the play-in; combine the second team into the first team
    if (row.playin_flag === true) {
      //Determine the even numbered slot (to be kept), and odd numbered slot (to be removed)
      let my_slot: number = row.team_slot
      let even_slot: number
      let odd_slot: number
      if (my_slot % 2 === 0) {
        even_slot = my_slot
        odd_slot = my_slot + 1
      } else {
        even_slot = my_slot - 1
        odd_slot = my_slot
      }
      //Check if the odd and even exist; otherwise don't do anything
      if (this.team_slot[even_slot] !== undefined && this.team_slot[odd_slot] !== undefined) {
        let even_row = this.team_slot[even_slot]
        let odd_row = this.team_slot[odd_slot]
        even_row.team_name = even_row.team_name + " / " + odd_row.team_name //Combine names
        even_row.team_region = even_row.team_region + " / " + odd_row.team_region //Combine regions
        even_row.team_id = even_row.team_id * 10000 + odd_row.team_id //Combine team ids
        even_row.team_rating = Math.max(even_row.team_rating, odd_row.team_rating) //Take best rating
        for (let i = 0; i < 7; i++) {
          even_row.rd_win[i] += odd_row.rd_win[i] //Combine win %
        }
        //Remove the odd row
        this.team_slot.delete(odd_slot)
      }
    }
  }
}

function unique_dates(csv: Array<Row>) {
  //Get the unique values for "forecast_date" from csv
  const s: Set<string> = new Set()
  for (let d of csv) {
    s.add(d.forecast_date)
  }
  return Array.from(s).sort()
}

function breakdown_dates(csv: Array<Row>) {
  //breakdown the big csv by date (Map), keep only mens tournament
  let dates = unique_dates(csv)
  let states: Map<string, State> = new Map()
  for (let date of dates) {
    states[date] = new State(date)
  }
  for (let row of csv) {
    if (row.gender === "mens") {
      //Skip womens tournament
      states[row.forecast_date].add_row(row)
    }
  }
  let states_arr: Array<State> = []
  for (let date of dates) {
    //Check through the states array, throw out any states that are empty
    if (Object.keys(states[date].team_id).length > 0) {
      states_arr.push(states[date])
    }
  }
  return states_arr
}

class Game {
  bracket: Bracket;
  round_num: number;
  game_num: number;
  team: [Row | undefined, Row | undefined]; //Two teams in the game
  winner_ind: undefined | 0 | 1
  winner: Row | undefined; //Winner of the game
  parent: [Game | undefined, Game | undefined]
  child: Game | undefined
  selector: HTMLElement
  radios: HTMLCollectionOf<any>
  labels: HTMLCollectionOf<HTMLElement>
  prob_selector: ProbSelector
  constructor(round_num: number, game_num: number, bracket: Bracket) {
    //Create a game
    this.bracket = bracket
    this.round_num = round_num
    this.game_num = game_num
    //Define parents of this game
    this.parent = this.bracket.get_parents(round_num, game_num)
    //set the children of the parent games
    for (let t = 0; t < 2; t++) {
      if (this.parent[t] !== undefined) {
        //Parent exists, pull parent information
        this.parent[t].add_child(this)
      } else {
        //No parent
      }
    }
    //Pull teams in round 1
    if (round_num === 1) {
      this.team = this.bracket.get_teams(this.round_num, this.game_num)
    } else {
      this.team = [undefined, undefined]
      //See if a winner has been determined from the previous rounds, if yes, pull that winner and save to the proper team
      for (let i = 0; i < 2; i++) {
        if (this.parent[i].winner !== undefined) {
          this.team[i] = this.parent[i].winner
        }
      }
    }
    //Pre-define the winner as unknown
    this.winner_ind = undefined
    this.winner = undefined
    //Pre-set game winner - check the percentages to see if the winner has already been decided
    for (let i = 0; i < 2; i++) {
      if (this.team[i] !== undefined) {
        if (this.team[i].rd_win[this.round_num] === 1) {
          this.winner_ind = i as 0 | 1
          this.winner = this.team[i]
        }
      }
    }
    //No children yet
    this.child = undefined
  }
  add_child(game: Game) {
    this.child = game
  }
  create_DOM(column: HTMLElement) {
    //Function for creating a DOM element for the game
    //Clone the selector
    this.selector = document.getElementById("selector-template").cloneNode(true) as HTMLElement
    //Save the selector id
    let selector_string: string = "selector_r" + this.round_num.toString() + "g" + this.game_num.toString()
    this.selector.id = selector_string
    //Changes the inputs and labels
    const selection_names = ["A", "B"]
    this.radios = this.selector.getElementsByTagName("input") //radio button
    this.labels = this.selector.getElementsByTagName("label") //label
    for (let i: 0 | 1 = 0; i < 2; i++) {
      //Change the radio button name and ids
      let inp = this.radios[i]
      inp.name = selector_string
      inp.id = selector_string + "_radio_" + selection_names[i]
      inp.onclick = x => this.on_select(i)
      //Change the labels id & for & text
      let lab = this.labels[i]
      lab.setAttribute("for", selector_string + "_radio_" + selection_names[i])
      lab.id = selector_string + "_text_" + selection_names[i]
    }
    this.update_DOM_text()
    //Append the selector to the provided column
    column.appendChild(this.selector)
  }
  on_select(selection_ind: 0 | 1) {
    this.winner_ind = selection_ind
    this.update()
    this.update_DOM()
  }
  set_winner_by_team_id(team_id: number) {
    //Set the winner of this game by the team_id, if undefined is provided, set winner to no-one
    //Throw an error if the team_id does not exist
    if (team_id === 0) {
      this.winner_ind = undefined
      this.update()
    } else if (team_id === this.team[0].team_id) {
      this.winner_ind = 0
      this.update()
    } else if (team_id === this.team[1].team_id) {
      this.winner_ind = 1
      this.update()
    } else {
      //The selected winner does not exist as a team option
      throw new Error("Selected team_id is not avaliable among the avaliable teams.")
    }
  }
  update() {
    //Get winners from parents
    if (this.round_num > 1) {
      for (let i = 0; i < 2; i++) {
        this.team[i] = this.parent[i].winner
      }
    }
    //Update my winner if appropriate
    if (this.winner_ind !== undefined) {
      if (this.team[this.winner_ind] !== undefined) {
        this.winner = this.team[this.winner_ind]
      } else {
        this.winner = undefined
      }
    } else {
      this.winner = undefined
    }
    //Update child
    if (this.child !== undefined) {
      this.child.update()
    }
  }
  update_DOM() {
    this.update_DOM_text()
    if (this.child !== undefined) {
      this.child.update_DOM()
    }
  }
  update_DOM_text() {
    //Update the text of the DOM element
    for (let i = 0; i < 2; i++) {
      if (this.team[i] === undefined) {
        this.labels[i].textContent = "-"
      } else {
        this.labels[i].textContent = this.team[i].team_name.toString()
      }
    }
    //Update the radio buttons of the DOM element (if appropriate)
    if (this.winner_ind !== undefined) {
      this.radios[this.winner_ind].checked = true
    } else {
      for (let i = 0; i < 2; i++) {
        this.radios[i].checked = false
      }
    }
  }
  create_ProbSelector() {
    //Function to create a ProbSelector for each game
    if (this.winner !== undefined) {
      //If the winner is determined, that is the only possible winner
      this.prob_selector = new ProbSelector([this.winner], this)
    } else if (this.round_num === 1) {
      //If its the first round, the two possible winners are the two teams
      this.prob_selector = new ProbSelector(this.team, this)
    } else {
      //Otherwise, the possible winners are the possible winners from the previous two games combined
      this.prob_selector = new ProbSelector(this.parent[0].prob_selector.elegible.concat(this.parent[1].prob_selector.elegible), this)
    }
  }

}

class Bracket {
  state: State;
  round: Array<Array<Game>>;
  constructor(state: State) {
    //Class holding the current state of each game in a bracket
    this.state = state
    //Games are refered to by Round (0 for play in, 6 for final), and GameInd (game number in that round, indexed at 0)
    this.round = new Array(7)
    //Round 0 - Empty, ignore the play in
    this.round[0] = new Array()
    for (let r = 1; r < 7; r++) {
      let g_max: number = 2 ** (6 - r)
      //Setup attay for holding the games in this round
      this.round[r] = new Array()
      for (let g = 0; g < g_max; g++) {
        let parents: [Game | undefined, Game | undefined] = this.get_parents(r, g)
        let game = new Game(r, g, this)
        this.round[r].push(game)
        for (let p of parents) {
          if (p !== undefined) {
            p.add_child(game)
          }
        }
      }
    }
  }
  get_game(round_num: number, game_num: number) {
    return this.round[round_num][game_num]
  }
  get_parents(round_num: number, game_num: number) {
    if (round_num > 1) {
      return [this.get_game(round_num - 1, game_num * 2), this.get_game(round_num - 1, game_num * 2 + 1)] as [Game | undefined, Game | undefined]
    } else {
      return [undefined, undefined] as [Game | undefined, Game | undefined]
    }
  }
  get_teams(round_num: number, game_num: number) {
    if (round_num === 1) {
      return [this.state.team_slot[game_num * 4], this.state.team_slot[game_num * 4 + 2]] as [Row, Row]
    } else {
      throw new Error("Cannot get teams except in the first round.")
    }
  }
  create_DOM(div_id: string) {
    //Add this bracket to the DOM under the HTMLElement specificed by the "div_id"
    let bracket_DOM: HTMLElement = document.getElementById("bracket-input")
    let column_template: HTMLElement = document.getElementById("column-template")
    for (let r = 1; r < 7; r++) {
      //Create a new_column on the DOM
      let new_column = column_template.cloneNode(true) as HTMLElement
      new_column.id = "input_r" + r.toString()
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Call the game to create the DOM element for that game
        this.get_game(r, g).create_DOM(new_column)
      }
      //Add the column to the DOM
      bracket_DOM.appendChild(new_column)
    }
    //Bind the "save" button to save this bracket as a SparseBracket
    let save_button: HTMLElement = document.getElementById("save-button")
    save_button.onclick = x => this.download()
  }
  convert_to_sparse() {
    //Convert the current bracket to a SparseBracket: an array of array of winners team numbers
    let sb: SparseBracket = [Array(),]
    for (let r = 1; r < 7; r++) {
      let roundArray: Array<number> = Array()
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Add winner index as appropriate
        if (this.get_game(r, g).winner === undefined) {
          roundArray.push(0)
        } else {
          roundArray.push(this.get_game(r, g).winner.team_id)
        }
      }
      //Add the roundArray to the SparseBracket
      sb.push(roundArray)
    }
    //Return the sparse bracket
    return sb
  }
  create_ProbSelector() {
    for (let r = 1; r < 7; r++) {
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Iterate through each game in order and create a probability selector
        this.get_game(r, g).create_ProbSelector()
      }
    }
  }
  generate_random_sparse() {
    //Generate a random SparseBracket
    //Must have called create_ProbSelector first, or this should error (at some point)
    let sb: SparseBracket = this.convert_to_sparse()
    for (let r = 6; r > 0; r--) { //Final to first round
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Check if spot is filled
        if (sb[r][g] === 0) {
          //Where a winner still needs to be decided
          let [team_id, team_slot]: Array<number> = this.get_game(r, g).prob_selector.random_winner()
          sb[r][g] = team_id
          //Set that as the winner of previous matches implicitly
          for (let r_parent = r - 1; r_parent > 0; r_parent--) {
            let g_parent: number = Math.floor(team_slot / (2 * 2 ** r_parent))
            sb[r_parent][g_parent] = team_id
          }
        }
      }
    }
    return sb
  }
  apply_SparseBracket(sparse_bracket: SparseBracket, update_DOM_flag: boolean) {
    //Update bracket to show the winners indicated by the SparseBracket
    for (let r = 1; r < 7; r++) {
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Winner not selected
        let game: Game = this.get_game(r, g)
        game.set_winner_by_team_id(sparse_bracket[r][g])
        if (update_DOM_flag) {
          game.update_DOM_text()
        }
      }
    }
  }
  download() {
    //Function for downloading the bracket created on the user side
    let bracket_name_DOM = document.getElementById("bracket-name") as any
    let bracket_name: string = bracket_name_DOM.value
    downloadObject(this.convert_to_sparse(), bracket_name)
  }
  clear_winners(update_DOM_flag: boolean) {
    //Clear all winners from the bracket
    for (let r = 1; r < 7; r++) {
      for (let g = 0; g < 2 ** (6 - r); g++) {
        //Winner not selected
        let game: Game = this.get_game(r, g)
        game.set_winner_by_team_id(0)
        if (update_DOM_flag) {
          game.update_DOM_text()
        }
      }
    }
  }
}

class ProbSelector {
  game: Game
  winner_flag: boolean
  elegible: Array<Row>
  team_id: Array<number>
  team_slot: Array<number>
  raw_prob: Array<number>
  cum_prob: Array<number>
  constructor(elegible: Array<Row>, game: Game) {
    //Class for holding and picking probabilities from a cumulative distribution
    this.game = game
    this.elegible = elegible
    if (this.elegible.length === 1) {
      //Winner has already been selected, no possibility of other winners
      this.winner_flag = true
      this.team_id = [this.elegible[0].team_id]
      this.team_slot = [this.elegible[0].team_slot]
      this.raw_prob = [1.0]
      this.cum_prob = [0.0, 1.0]
    } else {
      //Winner not selected, prepare to pick winner by chance
      this.winner_flag = false
      this.team_id = []
      this.team_slot = []
      this.raw_prob = []
      this.cum_prob = [0]
      let p_cum: number = 0
      for (let e of elegible) {
        this.team_id.push(e.team_id)
        this.team_slot.push(e.team_slot)
        let p: number = e.rd_win[this.game.round_num]
        this.raw_prob.push(p)
        p_cum += p
        this.cum_prob.push(p_cum)
      }
      //Confirm that cumulative probability is really close to 1
      if (!(p_cum > 0.999 && p_cum < 1.001)) {
        throw Error("Cumulative probability is not in the acticiapted range")
      }
      //Make the final number actually 1, to avoid errors later
      this.cum_prob[this.cum_prob.length - 1] = 1.0
    }
  }
  random_winner() {
    //Generate a random winner based on the proability distribution
    let rand: number = Math.random()
    for (let i = 0; i < this.team_id.length; i++) {
      if (rand < this.cum_prob[i + 1]) {
        return [this.team_id[i], this.team_slot[i]]
      }
    }
  }
}

function downloadObject(obj: any, filename: string) {
  //Object will be downloaded by the user as a json file
  var blob = new Blob([JSON.stringify(obj, null, null)], { type: "application/json;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var elem = document.createElement("a");
  elem.href = url;
  elem.download = filename;
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}

async function load_file_json(filepath: string) {
  //Load a file and convert to object using json
  let response = await fetch(filepath)
  let obj = await response.json()
  return obj
}

async function load_file_text(filepath: string) {
  //Load a file and convert to text
  let response = await fetch(filepath)
  let text = await response.text()
  return text
}

class Instance {
  sparse_bracket: SparseBracket
  score: Record<string, number>
  constructor(sparse_bracket: SparseBracket) {
    //class for storing an instance of a Bracket in SparseBracket format
    //With associated scores of user's sparse_brackets
    this.sparse_bracket = sparse_bracket
    this.score = {}
  }
  score_user(user_name: string, user_bracket: SparseBracket) {
    //Function for scoring a user provided bracket aganist this instance of the main sparse_bracket
    let s: number = 0
    for (let r = 1; r < 7; r++) {
      let score_per_game: number = 10 * 2 ** (r - 1)
      for (let g = 0; g < 2 ** (6 - r); g++) {
        if (this.sparse_bracket[r][g] === user_bracket[r][g]) {
          s += score_per_game
        }
      }
    }
    this.score[user_name] = s
  }
  rank_users() {
    //Returns the users in order from 1st to last place
    //Sorts users from best to worse (reverse sort)
    let users_sorted: Array<string> = Object.keys(this.score).sort((b, a) => { return this.score[a] - this.score[b] })
    return users_sorted
  }
}

interface DataType {
  fraction_by?: "place" | "user", //default - not a fraction (raw), otherwise, which row to fraction by
  as_percent?: boolean, //default - not a percent (raw)
  decimals?: number, //Number of decimals to round formatted amount to
  string_suffex?: string, //Suffex to add to strings
}

type Square<T> = Array<Record<string, T>>
class Table {
  raw_number: Square<number>
  formatted_number: Square<number>
  formatted_string: Square<string>
  current_format: DataType
  users: Array<string>
  N: number //Number of users
  constructor(user_names: Array<string>, format: DataType = {}) {
    //Create an empty square table of format place x user_name
    this.current_format = format
    this.N = Object.keys(user_names).length //number of users
    this.users = user_names
    //Setup the rank count data structure
    this.raw_number = this.fill_square(0)
    //Format as raw (the current data type)
    this.format()
  }
  fill_square(value: any) {
    //Return a filled square of the format requested
    let square: Square<any> = Array()
    for (let i = 0; i < this.N; i++) {
      let by_user: Record<string, number> = {}
      for (let user of this.users) {
        by_user[user] = value
      }
      square.push(by_user)
    }
    return square
  }
  copy_square(square: Square<any>) {
    let new_square: Square<any> = Array()
    for (let i = 0; i < this.N; i++) {
      let by_user: Record<string, number> = {}
      for (let user of this.users) {
        by_user[user] = square[i][user]
      }
      new_square.push(by_user)
    }
    return new_square
  }
  load_rank_count(instances: Array<Instance>) {
    //Count ranks by array of instances
    for (let inst of instances) {
      let users_ranked: Array<string> = inst.rank_users()
      for (let i = 0; i < this.N; i++) {
        this.raw_number[i][users_ranked[i]] += 1
      }
    }
    //Format as current data type after changing data
    this.format()
  }
  normalize(arr: Array<number>) {
    //normalize the given array of numbers and return
    let sum: number = 0
    for (let n of arr) {
      sum += n
    }
    let new_arr: Array<number> = Array()
    for (let n of arr) {
      new_arr.push(n / sum)
    }
    return new_arr
  }
  format(data_type: DataType = undefined) {
    //Format the data as requested
    //Save new data format
    if (data_type === undefined) {
      this.current_format = {}
    } else {
      this.current_format = data_type
    }
    //Format the data to the required type
    if (this.current_format.fraction_by === undefined) {
      //Format as raw
      this.formatted_number = this.copy_square(this.raw_number)
    } else {
      //Format as fraction
      //Clear existing format
      this.formatted_number = this.fill_square(0)
      if (this.current_format.fraction_by === "user") {
        //Calculate fractions by user
        for (let user of this.users) {
          let arr: Array<number> = this._get_by_user("raw_number", user)
          arr = this.normalize(arr)
          this._set_by_user("formatted_number", user, arr)
        }
      } else {
        //Calculate fractions by place
        for (let i = 0; i < this.N; i++) {
          let arr: Array<number> = this._get_by_place("raw_number", i)
          arr = this.normalize(arr)
          this._set_by_place("formatted_number", i, arr)
        }
      }
    }
    //Convert percent
    if (this.current_format.as_percent === true) {
      for (let i = 0; i < this.N; i++) {
        for (let user of this.users) {
          this.formatted_number[i][user] = this.formatted_number[i][user] * 100
        }
      }
    }
    //Round decimal
    if (this.current_format.decimals !== undefined) {
      for (let i = 0; i < this.N; i++) {
        for (let user of this.users) {
          this.formatted_number[i][user] = +this.formatted_number[i][user].toFixed(this.current_format.decimals)
        }
      }
    }
    //Format string type
    let suffex: string = ""
    if (this.current_format.string_suffex !== undefined) {
      suffex = this.current_format.string_suffex
    }
    this.formatted_string = this.fill_square("")
    for (let i = 0; i < this.N; i++) {
      for (let user of this.users) {
        this.formatted_string[i][user] = this.formatted_number[i][user].toString() + suffex
      }
    }
  }
  _get_by_place(attribute: string, place: number) {
    //Returns an array by place, in user order
    let arr: Array<any> = Array()
    for (let user of this.users) {
      arr.push(this[attribute][place][user])
    }
    return arr
  }
  _set_by_place(attribute: string, place: number, arr: Array<any>) {
    //Sets an array by place in user order
    for (let i = 0; i < this.N; i++) {
      this[attribute][place][this.users[i]] = arr[i]
    }
  }
  _get_by_user(attribute: string, user: string) {
    //Gets an array by user in place order
    let arr: Array<any> = Array()
    for (let i = 0; i < this.N; i++) {
      arr.push(this[attribute][i][user])
    }
    return arr
  }
  _set_by_user(attribute: string, user: string, arr: Array<any>) {
    //Sets and array by user in place order
    for (let i = 0; i < this.N; i++) {
      this[attribute][i][user] = arr[i]
    }
  }
  get_by_place(place: number, as_string: boolean = false) {
    //Return the data for a particular place, indexed from 0
    if (as_string) {
      return this.formatted_string[place]
    } else {
      return this.formatted_number[place]
    }
  }
  get_by_user(user: string, as_string: boolean = false) {
    //Return the data for a particular user
    if (as_string) {
      return this._get_by_user("formatted_string", user)
    } else {
      return this._get_by_user("formatted_number", user)
    }
  }
}

class Scenario {
  bracket: Bracket
  instance: Array<Instance>
  user_bracket: Record<string, SparseBracket>
  constructor(state: State, num_instances: number, user_brackets: Record<string, SparseBracket>) {
    //Scenario creates and stores Instance(s) for performing metrics aganist
    this.user_bracket = user_brackets
    //Create the bracket object from the scenario provided
    this.bracket = new Bracket(state)
    this.bracket.create_ProbSelector()
    //Generate # of instances of the given state
    this.instance = Array()
    for (let i = 0; i < num_instances; i++) {
      //Create random bracket, score each user aganist that random bracket
      let sb: SparseBracket = this.bracket.generate_random_sparse()
      let inst = new Instance(sb)
      for (let user in user_brackets) {
        inst.score_user(user, user_brackets[user])
      }
      this.instance.push(inst)
    }
  }
  count_by_rank() {
    //For each user, count the number of times they are in each position
    let rank_count: Record<string, Array<number>> = {}
    let table = new Table(Object.keys(this.user_bracket))
    table.load_rank_count(this.instance)
    return table
  }
}

class UserBracketManager {
  user_brackets: Record<string, SparseBracket>
  message_area: HTMLDivElement
  bracket: Bracket
  bracket_select_DOM: HTMLSelectElement
  bracket_option_template: HTMLOptionElement
  bracket_name_DOM: any
  constructor(earliest_state: State) {
    //Class for managing and creating user files
    this.message_area = document.getElementById("message-area") as HTMLDivElement
    this.set_message("Loading...")
    //Load the earliest bracket as a basis for selecting brackets
    this.bracket = new Bracket(earliest_state)
    this.bracket.create_ProbSelector() //Calculate probabilities for each game
    this.bracket.create_DOM("bracket-input")
    //load() must be called to make the UserBracketManager useable
    this.set_message("ERROR: load() must be called to be useable.")
  }
  async load() {
    //Make the user bracket manager useable
    this.set_message("Setting...")
    //Load the user bracekts from file
    this.user_brackets = await load_file_json("user_brackets.json")
    //Save field areas
    this.bracket_select_DOM = document.getElementById("bracket-select") as HTMLSelectElement
    this.bracket_select_DOM.onchange = x => this.bracket_select()
    this.bracket_name_DOM = document.getElementById("bracket-name")
    //Save select option area
    this.bracket_option_template = document.getElementById("bracket-select-option-template") as HTMLOptionElement
    //Apply functions to the buttons
    document.getElementById("refresh-button").onclick = x => this.refresh()
    document.getElementById("delete-button").onclick = x => this.delete()
    document.getElementById("save-button").onclick = x => this.save()
    document.getElementById("download-brackets").onclick = x => this.download()
    document.getElementById("upload-brackets").onclick = x => this.upload()
    //Update the selector
    this.update_bracket_select()
    //Select the first option
    this.bracket_select()
  }
  update_bracket_select() {
    //Update the bracket selector, clear the old, add new
    //Clear existing options
    while (this.bracket_select_DOM.options.length > 2) {
      this.bracket_select_DOM.remove(2)
    }
    //Add new options
    for (let user in this.user_brackets) {
      let new_option = this.bracket_option_template.cloneNode(true) as HTMLOptionElement
      new_option.textContent = user
      new_option.value = user
      this.bracket_select_DOM.appendChild(new_option)
    }
  }
  bracket_select() {
    //Use the "Show" field to select a bracket: new, random, or existing
    let value: string = this.bracket_select_DOM.value
    if (value === "new-bracket") {
      this.new_bracket()
    } else if (value === "random-bracket") {
      this.random_bracket()
    } else {
      this.load_bracket(value)
    }
  }
  refresh() {
    //Re-load the current bracket being shown
    this.bracket_select()
  }
  delete() {
    //Delete the "Bracket Name" from the user brackets
    let value: string = this.bracket_name_DOM.value
    if (value in this.user_brackets) {
      delete this.user_brackets[value]
      this.update_bracket_select()
      this.set_message("Bracket deleted.")
    } else {
      this.set_message("Error Deleting: Bracket name does not exist. Characters must match exactly.")
    }
  }
  save() {
    //Save the "Bracket Name" to the user_brackets
    let user: string = this.bracket_name_DOM.value
    var re = /^\w+$/;
    //Make sure the user name is valid
    if (user.length > 10) {
      this.set_message("Error Saving: Bracket name must be 10 characters or less.")
    } else if (!re.test(user)) {
      this.set_message("Error Saving: Bracket name can only contain letters, numbers, and underscores.")
    } else {
      let sb: SparseBracket = this.bracket.convert_to_sparse()
      let valid: boolean = true
      for (let r = 1; r < 7; r++) {
        for (let g = 0; g < 2 ** (6 - r); g++) {
          if (sb[r][g] === 0) {
            valid = false
          }
        }
      }
      if (valid) {
        //Sparse bracket appears to be valid, save it to the user_brackets
        this.user_brackets[user] = sb
        this.update_bracket_select()
        this.bracket_select()
        this.set_message("Save complete. Don't forget to download.")
      } else {
        this.set_message("Error Saving: Not all selections have been made.")
      }
    }
  }
  download() {
    //Download the current user brackets
    downloadObject(this.user_brackets, "user_brackets")
    this.set_message("Downloading...")
  }
  upload() {
    //Upload a .json file containing user brackets
    //TODO - not yet built
    this.set_message("Error: This function is not yet built.")
  }
  set_message(message: string) {
    //Set the message area
    this.message_area.textContent = message
  }
  set_bracket_name(user_name: string) {
    this.bracket_name_DOM.value = user_name
  }
  new_bracket() {
    //Load a scratch bracket for in-filling
    this.bracket.clear_winners(true)
    this.set_bracket_name("new")
    this.set_message("Input a bracket name and set winners, then click save.")
  }
  random_bracket() {
    //Create a random bracket using the weights of each team winning a game
    this.bracket.clear_winners(true)
    let sb: SparseBracket = this.bracket.generate_random_sparse()
    this.bracket.apply_SparseBracket(sb, true)
    this.set_bracket_name("random")
    this.set_message("Random bracket created based on weights of each team.")
  }
  load_bracket(user_name: string) {
    //Load a bracket by name
    let sb: SparseBracket = this.user_brackets[user_name]
    this.bracket.clear_winners(true)
    this.bracket.apply_SparseBracket(sb, true)
    this.set_bracket_name(user_name)
    this.set_message("Loaded user bracket.")
  }
}
interface ChartDataSet {
  data: Array<any> //Cannot immediatly define the data type
  label?: string
  backgroundColor?: string
}

class MyChart {
  div_DOM: HTMLDivElement
  chart: any
  config: any
  data: any
  dataset: Array<ChartDataSet>
  constructor(div_id: string, type: string) {
    //Class for standard chart setup functions, etc
    this.div_DOM = document.getElementById(div_id) as HTMLDivElement
    this.config = {
      type: type
      //data: To be added just before graphing
      //plugins: To be added just before gaphing
    }
    this.data = {
      //labels: Added with special function call
      dataset: []
    }
  }
  add_group_labels(labels: Array<string>) {
    this.data.label = labels
  }
  generate_labels(num_players: number) {
    //Function to generate labels in an array
    let arr: Array<string> = ["1st", "2nd", "3rd"]
    for (let i = 3; i < num_players; i++) {
      arr.push((i + 1).toString() + "th")
    }
    return arr.slice(0, num_players)
  }
  get_color(player_num: number) {
    let colors = ["#DFFF00", "#FFBF00", "#FF7F50", "#DE3163", "#9FE2BF", "#40E0D0", "#6495ED", "#CCCCFF",]
    if (player_num < 8) {
      return colors[player_num]
    } else {
      return "#000000" //blck
    }
  }
}

class StackedChart extends MyChart {
  constructor(div_id: string, scenario: Scenario) {
    super(div_id)
    //Create a stacket chart showing each player and their likely finish rank
    let table: Table = scenario.count_by_rank()
    table.format({ fraction_by: "place", as_percent: true, decimals: 2, string_suffex: "%" })
    //Prepare the chart
  }
}

//---------------------------------------------------------------


async function main() {
  //Load the primary csv File and convert to states
  let text: string = await load_file_text(".//fivethirtyeight_ncaa_forecasts.csv")
  let csv = csvToArray(text)
  let states: Array<State> = breakdown_dates(csv)
  //Load the bracket creator
  let manager = new UserBracketManager(states[0])
  await manager.load()
  //Tests with Scenario
  let scenario = new Scenario(states[states.length - 1], 10000, manager.user_brackets)
  console.log(scenario)
  let table = scenario.count_by_rank()
  table.format({ fraction_by: "place", as_percent: true, decimals: 2, string_suffex: "%" })
  console.log(table)
  // Playing with graphing!
  graphtest(table)

}

main()

function graphtest(table: Table) {
  const ctx = document.getElementById('stacked-chart');
  //Create the base data structure
  const data = {
    labels: ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"],
    datasets: []
  }
  //Create the data
  const background_colors = ["#DFFF00", "#FFBF00", "#FF7F50", "#DE3163", "#9FE2BF", "#40E0D0", "#6495ED", "#CCCCFF",]
  for (let i = 0; i < table.N; i++) {
    let user: string = table.users[i]
    let ds = {
      label: user,
      data: table.get_by_user(user, false),
      backgroundColor: background_colors[i]
    }
    data.datasets.push(ds)
  }
  //Create the config file
  const config = {
    type: 'bar',
    data: data,
    options: {
      plugins: {
        // title: {
        //   display: true,
        //   text: 'Current Probability of Each Player Getting Each Place'
        // },
        legend: {
          position: "right",
          reverse: true,
        },
      },
      responsive: true,
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          max: 100,
        },
      }
    }
  };
  //Actually graph
  const myChart = new Chart(ctx, config);
}