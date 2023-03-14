console.log("start");
//Short Name Definitions
let short_name_lookup = {
    max_length: 13,
    header_printed: false,
    already_alerted: [],
    map: {
        "Georgia State": "Georgia St",
        "Boise State": "Bosie St",
        "North Carolina": "N Carolina",
        "Saint Peter's": "St Peter's",
        "New Mexico State": "NM State",
        "Michigan State": "Michigan St",
        "Saint Mary's (CA)": "St Mary's CA",
        "Texas Christian": "TX Christian",
        "Cal State Fullerton": "CSU Fullerton",
        "Texas Southern": "TX Southern",
        "San Diego State": "San Diego St",
        "South Dakota State": "S Dakota St",
        "Louisiana State": "LSU",
        "Southern California": "USC",
        "Jacksonville State": "Jacksonville",
        "Alabama-Birmingham": "UAB",
        "Colorado State": "Colorado St",
        "Rutgers / Notre Dame": "Rut. / ND",
        "Wyoming / Indiana": "WY / Indiana",
        "Texas Southern / Texas A&M-Corpus Christi": "TX S/A&M-CC,",
        "Wright State / Bryant": "Wright / Bry.",
    }
};
//
function csvToArray2(str, delimiter = ",") {
    //Take csv as a string and convert to array of Objects, convert numbers to numbers
    //Based on a stack overflow answer
    const headers = str.slice(0, str.indexOf("\n")).split(delimiter);
    const rows = str.slice(str.indexOf("\n") + 1).split("\n").slice(0, -1); //Ignore the final \n that closes the file
    // Map the rows
    const arr = rows.map(row => {
        const values = row.split(delimiter);
        let object = {
            gender: values[0], forecast_date: values[1], playin_flag: !!values[2],
            rd_win: values.slice(3, 10).map(x => Number(x)),
            results_to: Number(values[10]) - 1, team_alive: !!values[11],
            team_id: Number(values[12]), team_name: values[13], team_rating: Number(values[14]), team_region: values[15], team_seed: values[16], team_slot: Number(values[17]),
            short_team_name: "",
        };
        return object;
    });
    return arr; // return the array
}
class State {
    constructor(date) {
        //Save the state of the tournament in a useable format for a given date
        //CSV must be cleaned in advance, such that there is only 1 instance of each team & each rank provided
        this.date = date;
        this.team_id = new Map();
        this.team_slot = new Map();
    }
    add_row(row) {
        this.team_id[row.team_id] = row;
        this.team_slot[row.team_slot] = row;
        //Cleanup rows that are part of the play-in; combine the second team into the first team
        if (row.playin_flag === true) {
            //Determine the even numbered slot (to be kept), and odd numbered slot (to be removed)
            let my_slot = row.team_slot;
            let even_slot;
            let odd_slot;
            if (my_slot % 2 === 0) {
                even_slot = my_slot;
                odd_slot = my_slot + 1;
            }
            else {
                even_slot = my_slot - 1;
                odd_slot = my_slot;
            }
            //Check if the odd and even exist; otherwise don't do anything
            if (this.team_slot[even_slot] !== undefined && this.team_slot[odd_slot] !== undefined) {
                let even_row = this.team_slot[even_slot];
                let odd_row = this.team_slot[odd_slot];
                even_row.team_name = even_row.team_name + " / " + odd_row.team_name; //Combine names
                even_row.team_region = even_row.team_region + " / " + odd_row.team_region; //Combine regions
                even_row.team_id = even_row.team_id * 10000 + odd_row.team_id; //Combine team ids
                even_row.team_rating = Math.max(even_row.team_rating, odd_row.team_rating); //Take best rating
                for (let i = 0; i < 7; i++) {
                    even_row.rd_win[i] += odd_row.rd_win[i]; //Combine win %
                }
                //Remove the origional rows
                this.team_slot.delete(odd_slot);
                //Add new team_id
                row = even_row; //Re-name the row
                this.team_id[even_row.team_id] = row;
            }
        }
        //Add short_team_name - shows the rank and a simplified team name
        let short_name;
        if (short_name_lookup.map[row.team_name] === undefined) {
            short_name = row.team_name;
        }
        else {
            short_name = short_name_lookup.map[row.team_name];
        }
        //Alert User of long names
        if (short_name.length > short_name_lookup.max_length &&
            !short_name_lookup.already_alerted.includes(short_name)) {
            //If first alert, write a header
            if (short_name_lookup.header_printed === false) {
                short_name_lookup.header_printed = true;
                console.log("Teams with short_team_name that are too long. Max length:", short_name_lookup.max_length);
            }
            //Only alert if not seen before 
            short_name_lookup.already_alerted.push(short_name);
            console.log(short_name, "|", short_name.length);
        }
        //Add the short_name to the row - after adding the team rank
        short_name = row.team_seed.slice(0, 2) + " " + short_name;
        row.short_team_name = short_name;
    }
}
function unique_dates(csv) {
    //Get the unique values for "forecast_date" from csv
    const s = new Set();
    for (let d of csv) {
        s.add(d.forecast_date);
    }
    return Array.from(s).sort();
}
function breakdown_dates(csv) {
    //breakdown the big csv by date (Map), keep only mens tournament
    let dates = unique_dates(csv);
    let states = new Map();
    for (let date of dates) {
        states[date] = new State(date);
    }
    for (let row of csv) {
        if (row.gender === "mens") {
            //Skip womens tournament
            states[row.forecast_date].add_row(row);
        }
    }
    let states_arr = [];
    let dates_arr = [];
    for (let date of dates) {
        //Check through the states array, throw out any states that are empty
        if (Object.keys(states[date].team_id).length > 0) {
            states_arr.push(states[date]);
            dates_arr.push(date);
        }
    }
    return [states_arr, dates_arr];
}
class Game {
    constructor(round_num, game_num, bracket) {
        //Create a game
        this.bracket = bracket;
        this.round_num = round_num;
        this.game_num = game_num;
        //Define parents of this game
        this.parent = this.bracket.get_parents(round_num, game_num);
        //set the children of the parent games
        for (let t = 0; t < 2; t++) {
            if (this.parent[t] !== undefined) {
                //Parent exists, pull parent information
                this.parent[t].add_child(this);
            }
            else {
                //No parent
            }
        }
        //Pull teams in round 1
        if (round_num === 1) {
            this.team = this.bracket.get_teams(this.round_num, this.game_num);
        }
        else {
            this.team = [undefined, undefined];
            //See if a winner has been determined from the previous rounds, if yes, pull that winner and save to the proper team
            for (let i = 0; i < 2; i++) {
                if (this.parent[i].winner !== undefined) {
                    this.team[i] = this.parent[i].winner;
                }
            }
        }
        //Pre-define the winner as unknown
        this.winner_ind = undefined;
        this.winner = undefined;
        //Pre-set game winner - check the percentages to see if the winner has already been decided
        for (let i = 0; i < 2; i++) {
            if (this.team[i] !== undefined) {
                if (this.team[i].rd_win[this.round_num] === 1) {
                    this.winner_ind = i;
                    this.winner = this.team[i];
                }
            }
        }
        //No children yet
        this.child = undefined;
    }
    add_child(game) {
        this.child = game;
    }
    create_DOM(column) {
        //Function for creating a DOM element for the game
        //Clone the selector
        this.selector = document.getElementById("selector-template").cloneNode(true);
        //Save the selector id
        let selector_string = "selector_r" + this.round_num.toString() + "g" + this.game_num.toString();
        this.selector.id = selector_string;
        //Changes the inputs and labels
        const selection_names = ["A", "B"];
        this.radios = this.selector.getElementsByTagName("input"); //radio button
        this.labels = this.selector.getElementsByTagName("label"); //label
        for (let i = 0; i < 2; i++) {
            //Change the radio button name and ids
            let inp = this.radios[i];
            inp.name = selector_string;
            inp.id = selector_string + "_radio_" + selection_names[i];
            inp.onclick = x => this.on_select(i);
            //Change the labels id & for & text
            let lab = this.labels[i];
            lab.setAttribute("for", selector_string + "_radio_" + selection_names[i]);
            lab.id = selector_string + "_text_" + selection_names[i];
        }
        this.update_DOM_text();
        //Append the selector to the provided column
        column.appendChild(this.selector);
    }
    on_select(selection_ind) {
        this.winner_ind = selection_ind;
        this.update();
        this.update_DOM();
    }
    set_winner_by_team_id(team_id) {
        //Set the winner of this game by the team_id, if undefined is provided, set winner to no-one
        //Throw an error if the team_id does not exist
        if (team_id === 0) {
            this.winner_ind = undefined;
            this.update();
        }
        else if (team_id === this.team[0].team_id) {
            this.winner_ind = 0;
            this.update();
        }
        else if (team_id === this.team[1].team_id) {
            this.winner_ind = 1;
            this.update();
        }
        else {
            //The selected winner does not exist as a team option
            throw new Error("Selected team_id is not avaliable among the avaliable teams.");
        }
    }
    update() {
        //Get winners from parents
        if (this.round_num > 1) {
            for (let i = 0; i < 2; i++) {
                this.team[i] = this.parent[i].winner;
            }
        }
        //Update my winner if appropriate
        if (this.winner_ind !== undefined) {
            if (this.team[this.winner_ind] !== undefined) {
                this.winner = this.team[this.winner_ind];
            }
            else {
                this.winner = undefined;
            }
        }
        else {
            this.winner = undefined;
        }
        //Update child
        if (this.child !== undefined) {
            this.child.update();
        }
    }
    update_DOM() {
        this.update_DOM_text();
        if (this.child !== undefined) {
            this.child.update_DOM();
        }
    }
    update_DOM_text() {
        //Update the text of the DOM element
        for (let i = 0; i < 2; i++) {
            if (this.team[i] === undefined) {
                this.labels[i].textContent = "-";
            }
            else {
                this.labels[i].textContent = this.team[i].short_team_name.toString();
            }
        }
        //Update the radio buttons of the DOM element (if appropriate)
        if (this.winner_ind !== undefined) {
            this.radios[this.winner_ind].checked = true;
        }
        else {
            for (let i = 0; i < 2; i++) {
                this.radios[i].checked = false;
            }
        }
    }
    create_ProbSelector() {
        //Function to create a ProbSelector for each game
        if (this.winner !== undefined) {
            //If the winner is determined, that is the only possible winner
            this.prob_selector = new ProbSelector([this.winner], this);
        }
        else if (this.round_num === 1) {
            //If its the first round, the two possible winners are the two teams
            this.prob_selector = new ProbSelector(this.team, this);
        }
        else {
            //Otherwise, the possible winners are the possible winners from the previous two games combined
            this.prob_selector = new ProbSelector(this.parent[0].prob_selector.elegible.concat(this.parent[1].prob_selector.elegible), this);
        }
    }
}
class Bracket {
    constructor(state) {
        //Class holding the current state of each game in a bracket
        this.state = state;
        //Games are refered to by Round (0 for play in, 6 for final), and GameInd (game number in that round, indexed at 0)
        this.round = new Array(7);
        //Round 0 - Empty, ignore the play in
        this.round[0] = new Array();
        for (let r = 1; r < 7; r++) {
            let g_max = 2 ** (6 - r);
            //Setup attay for holding the games in this round
            this.round[r] = new Array();
            for (let g = 0; g < g_max; g++) {
                let parents = this.get_parents(r, g);
                let game = new Game(r, g, this);
                this.round[r].push(game);
                for (let p of parents) {
                    if (p !== undefined) {
                        p.add_child(game);
                    }
                }
            }
        }
    }
    get_game(round_num, game_num) {
        return this.round[round_num][game_num];
    }
    get_parents(round_num, game_num) {
        if (round_num > 1) {
            return [this.get_game(round_num - 1, game_num * 2), this.get_game(round_num - 1, game_num * 2 + 1)];
        }
        else {
            return [undefined, undefined];
        }
    }
    get_teams(round_num, game_num) {
        if (round_num === 1) {
            return [this.state.team_slot[game_num * 4], this.state.team_slot[game_num * 4 + 2]];
        }
        else {
            throw new Error("Cannot get teams except in the first round.");
        }
    }
    create_DOM(div_id) {
        //Add this bracket to the DOM under the HTMLElement specificed by the "div_id"
        let bracket_DOM = document.getElementById("bracket-input");
        let column_template = document.getElementById("column-template");
        for (let r = 1; r < 7; r++) {
            //Create a new_column on the DOM
            let new_column = column_template.cloneNode(true);
            new_column.id = "input_r" + r.toString();
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Call the game to create the DOM element for that game
                this.get_game(r, g).create_DOM(new_column);
            }
            //Add the column to the DOM
            bracket_DOM.appendChild(new_column);
        }
        //Bind the "save" button to save this bracket as a SparseBracket
        let save_button = document.getElementById("save-button");
        save_button.onclick = x => this.download();
    }
    convert_to_sparse() {
        //Convert the current bracket to a SparseBracket: an array of array of winners team numbers
        let sb = [Array(),];
        for (let r = 1; r < 7; r++) {
            let roundArray = Array();
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Add winner index as appropriate
                if (this.get_game(r, g).winner === undefined) {
                    roundArray.push(0);
                }
                else {
                    roundArray.push(this.get_game(r, g).winner.team_id);
                }
            }
            //Add the roundArray to the SparseBracket
            sb.push(roundArray);
        }
        //Return the sparse bracket
        return sb;
    }
    create_ProbSelector() {
        for (let r = 1; r < 7; r++) {
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Iterate through each game in order and create a probability selector
                this.get_game(r, g).create_ProbSelector();
            }
        }
    }
    generate_random_sparse() {
        //Generate a random SparseBracket
        //Must have called create_ProbSelector first, or this should error (at some point)
        let sb = this.convert_to_sparse();
        for (let r = 6; r > 0; r--) { //Final to first round
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Check if spot is filled
                if (sb[r][g] === 0) {
                    //Where a winner still needs to be decided
                    let [team_id, team_slot] = this.get_game(r, g).prob_selector.random_winner();
                    sb[r][g] = team_id;
                    //Set that as the winner of previous matches implicitly
                    for (let r_parent = r - 1; r_parent > 0; r_parent--) {
                        let g_parent = Math.floor(team_slot / (2 * 2 ** r_parent));
                        sb[r_parent][g_parent] = team_id;
                    }
                }
            }
        }
        return sb;
    }
    apply_SparseBracket(sparse_bracket, update_DOM_flag) {
        //Update bracket to show the winners indicated by the SparseBracket
        for (let r = 1; r < 7; r++) {
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Winner not selected
                let game = this.get_game(r, g);
                game.set_winner_by_team_id(sparse_bracket[r][g]);
                if (update_DOM_flag) {
                    game.update_DOM_text();
                }
            }
        }
    }
    download() {
        //Function for downloading the bracket created on the user side
        let bracket_name_DOM = document.getElementById("bracket-name");
        let bracket_name = bracket_name_DOM.value;
        downloadObject(this.convert_to_sparse(), bracket_name);
    }
    clear_winners(update_DOM_flag) {
        //Clear all winners from the bracket
        for (let r = 1; r < 7; r++) {
            for (let g = 0; g < 2 ** (6 - r); g++) {
                //Winner not selected
                let game = this.get_game(r, g);
                game.set_winner_by_team_id(0);
                if (update_DOM_flag) {
                    game.update_DOM_text();
                }
            }
        }
    }
    *yield_each_game() {
        //Yield each games from the Bracket round property, iterate by round, then game in round
        //Generator function
        for (let r = 1; r < 7; r++) {
            for (let g = 0; g < 2 ** (6 - r); g++) {
                yield this.get_game(r, g);
            }
        }
    }
}
class ProbSelector {
    constructor(elegible, game) {
        //Class for holding and picking probabilities from a cumulative distribution
        this.game = game;
        this.elegible = elegible;
        if (this.elegible.length === 1) {
            //Winner has already been selected, no possibility of other winners
            this.winner_flag = true;
            this.team_id = [this.elegible[0].team_id];
            this.team_slot = [this.elegible[0].team_slot];
            this.raw_prob = [1.0];
            this.cum_prob = [0.0, 1.0];
        }
        else {
            //Winner not selected, prepare to pick winner by chance
            this.winner_flag = false;
            this.team_id = [];
            this.team_slot = [];
            this.raw_prob = [];
            let p_sum = 0;
            for (let e of elegible) {
                this.team_id.push(e.team_id);
                this.team_slot.push(e.team_slot);
                let p;
                if (this.game.round_num === 6) {
                    p = e.rd_win[this.game.round_num];
                }
                else {
                    //Future rounds normalized to P(Ai | Ci+1) = [P(Ai) - P(Ai+1)] / P(Ci+1)
                    //Denominator can be applied later since it should be the same for all
                    p = e.rd_win[this.game.round_num] - e.rd_win[this.game.round_num + 1];
                }
                this.raw_prob.push(p);
                p_sum += p;
            }
            //Normalize probabilities
            this.cum_prob = [0];
            let p_cum = 0;
            for (let raw_p of this.raw_prob) {
                p_cum += raw_p;
                this.cum_prob.push(p_cum / p_sum);
            }
            //Make the final number actually 1, to avoid errors later
            this.cum_prob[this.cum_prob.length - 1] = 1.0;
        }
    }
    random_winner() {
        //Generate a random winner based on the proability distribution
        let rand = Math.random();
        for (let i = 0; i < this.team_id.length; i++) {
            if (rand < this.cum_prob[i + 1]) {
                return [this.team_id[i], this.team_slot[i]];
            }
        }
    }
}
function downloadObject(obj, filename) {
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
async function load_file_json(filepath) {
    //Load a file and convert to object using json
    let response = await fetch(filepath);
    let obj = await response.json();
    return obj;
}
async function load_file_text(filepath) {
    //Load a file and convert to text
    let response = await fetch(filepath);
    let text = await response.text();
    return text;
}
class Instance {
    constructor(sparse_bracket, user_brackets_dict) {
        //class for storing an instance of a Bracket in SparseBracket format
        //With associated scores of user's sparse_brackets
        this.sparse_bracket = sparse_bracket;
        this.score = {};
        if (user_brackets_dict !== undefined) {
            this.score_users(user_brackets_dict);
        }
    }
    score_users(user_brackets_dict) {
        //Score all the users provided
        for (let user in user_brackets_dict) {
            this.score_user(user, user_brackets_dict[user]);
        }
    }
    score_user(user_name, user_bracket) {
        //Function for scoring a user provided bracket aganist this instance of the main sparse_bracket
        let s = 0;
        for (let r = 1; r < 7; r++) {
            let score_per_game = 10 * 2 ** (r - 1);
            for (let g = 0; g < 2 ** (6 - r); g++) {
                if (this.sparse_bracket[r][g] === user_bracket[r][g]) {
                    s += score_per_game;
                }
            }
        }
        this.score[user_name] = s;
    }
    rank_users() {
        //Returns the users in order from 1st to last place
        //Sorts users from best to worse (reverse sort)
        let users_sorted = Object.keys(this.score).sort((b, a) => { return this.score[a] - this.score[b]; });
        return users_sorted;
    }
}
class Table {
    constructor(user_names, format = {}) {
        //Create an empty square table of format place x user_name
        this.current_format = format;
        this.N = Object.keys(user_names).length; //number of users
        this.users = user_names;
        //Setup the rank count data structure
        this.raw_number = this.fill_square(0);
        //Format as raw (the current data type)
        this.format();
    }
    count_instances() {
        //Count the number of instances that are counted in the Table
        let sum = 0;
        for (let user in this.raw_number[0]) {
            sum += this.raw_number[0][user];
        }
        return sum;
    }
    fill_square(value) {
        //Return a filled square of the format requested
        let square = Array();
        for (let i = 0; i < this.N; i++) {
            let by_user = {};
            for (let user of this.users) {
                by_user[user] = value;
            }
            square.push(by_user);
        }
        return square;
    }
    copy_square(square) {
        let new_square = Array();
        for (let i = 0; i < this.N; i++) {
            let by_user = {};
            for (let user of this.users) {
                by_user[user] = square[i][user];
            }
            new_square.push(by_user);
        }
        return new_square;
    }
    load_rank_count(instances) {
        //Count ranks by array of instances
        for (let inst of instances) {
            let users_ranked = inst.rank_users();
            for (let i = 0; i < this.N; i++) {
                this.raw_number[i][users_ranked[i]] += 1;
            }
        }
        //Format as current data type after changing data
        this.format();
    }
    normalize(arr) {
        //normalize the given array of numbers and return
        let sum = 0;
        for (let n of arr) {
            sum += n;
        }
        let new_arr = Array();
        for (let n of arr) {
            new_arr.push(n / sum);
        }
        return new_arr;
    }
    format(data_type = undefined) {
        //Format the data as requested
        //Save new data format
        if (data_type === undefined) {
            this.current_format = {};
        }
        else {
            this.current_format = data_type;
        }
        //Format the data to the required type
        if (this.current_format.fraction_by === undefined) {
            //Format as raw
            this.formatted_number = this.copy_square(this.raw_number);
        }
        else {
            //Format as fraction
            //Clear existing format
            this.formatted_number = this.fill_square(0);
            if (this.current_format.fraction_by === "user") {
                //Calculate fractions by user
                for (let user of this.users) {
                    let arr = this._get_by_user("raw_number", user);
                    arr = this.normalize(arr);
                    this._set_by_user("formatted_number", user, arr);
                }
            }
            else {
                //Calculate fractions by place
                for (let i = 0; i < this.N; i++) {
                    let arr = this._get_by_place("raw_number", i);
                    arr = this.normalize(arr);
                    this._set_by_place("formatted_number", i, arr);
                }
            }
        }
        //Convert percent
        if (this.current_format.as_percent === true) {
            for (let i = 0; i < this.N; i++) {
                for (let user of this.users) {
                    this.formatted_number[i][user] = this.formatted_number[i][user] * 100;
                }
            }
        }
        //Round decimal
        if (this.current_format.decimals !== undefined) {
            for (let i = 0; i < this.N; i++) {
                for (let user of this.users) {
                    this.formatted_number[i][user] = +this.formatted_number[i][user].toFixed(this.current_format.decimals);
                }
            }
        }
        //Format string type
        let suffex = "";
        if (this.current_format.string_suffex !== undefined) {
            suffex = this.current_format.string_suffex;
        }
        this.formatted_string = this.fill_square("");
        for (let i = 0; i < this.N; i++) {
            for (let user of this.users) {
                this.formatted_string[i][user] = this.formatted_number[i][user].toString() + suffex;
            }
        }
    }
    _get_by_place(attribute, place) {
        //Returns an array by place, in user order
        let arr = Array();
        for (let user of this.users) {
            arr.push(this[attribute][place][user]);
        }
        return arr;
    }
    _set_by_place(attribute, place, arr) {
        //Sets an array by place in user order
        for (let i = 0; i < this.N; i++) {
            this[attribute][place][this.users[i]] = arr[i];
        }
    }
    _get_by_user(attribute, user) {
        //Gets an array by user in place order
        let arr = Array();
        for (let i = 0; i < this.N; i++) {
            arr.push(this[attribute][i][user]);
        }
        return arr;
    }
    _set_by_user(attribute, user, arr) {
        //Sets and array by user in place order
        for (let i = 0; i < this.N; i++) {
            this[attribute][i][user] = arr[i];
        }
    }
    get_by_place(place, as_string = false) {
        //Return the data for a particular place, indexed from 0
        if (as_string) {
            return this.formatted_string[place];
        }
        else {
            return this.formatted_number[place];
        }
    }
    get_by_user(user, as_string = false) {
        //Return the data for a particular user
        if (as_string) {
            return this._get_by_user("formatted_string", user);
        }
        else {
            return this._get_by_user("formatted_number", user);
        }
    }
}
class BaseScenario {
    constructor(user_brackets) {
        //Unfilled scenario
        this.user_bracket = user_brackets;
        this.instance = Array();
    }
    count_by_rank() {
        //For each user, count the number of times they are in each position
        let table = new Table(Object.keys(this.user_bracket));
        table.load_rank_count(this.instance);
        return table;
    }
    split(r, g) {
        //Split the scenario into two scenarios based on the outcome of a stated game (r,g)
        let new_scenarios = {};
        for (let inst of this.instance) {
            if (new_scenarios[inst.sparse_bracket[r][g]] === undefined) {
                //Create scenario if not yet existing
                new_scenarios[inst.sparse_bracket[r][g]] = new BaseScenario(this.user_bracket);
            }
            new_scenarios[inst.sparse_bracket[r][g]].instance.push(inst);
        }
        return new_scenarios;
    }
}
class Scenario extends BaseScenario {
    constructor(state, num_instances, user_brackets) {
        super(user_brackets);
        //Create the bracket object from the scenario provided
        this.bracket = new Bracket(state);
        this.bracket.create_ProbSelector();
        //Generate # of instances of the given state
        for (let i = 0; i < num_instances; i++) {
            //Create random bracket, score each user aganist that random bracket
            let sb = this.bracket.generate_random_sparse();
            let inst = new Instance(sb, user_brackets);
            this.instance.push(inst);
        }
    }
}
class UserBracketManager {
    constructor(earliest_state) {
        //Class for managing and creating user files
        this.message_area = document.getElementById("message-area");
        this.bracket_name_DOM = document.getElementById("bracket-name");
        this.set_message("Loading...");
        //Load the earliest bracket as a basis for selecting brackets
        this.bracket = new Bracket(earliest_state);
        this.bracket.create_ProbSelector(); //Calculate probabilities for each game
        this.bracket.create_DOM("bracket-input");
        //load() must be called to make the UserBracketManager useable
        this.set_message("ERROR: load() must be called to be useable.");
    }
    async load() {
        //Make the user bracket manager useable
        this.set_message("Setting...");
        //Load the user bracekts from file
        this.user_brackets = await load_file_json("user_brackets.json");
        //Save field areas
        this.bracket_selector = new Selector("bracket-select", ["New Bracket", "Random Bracket"], Object.keys(this.user_brackets), (value) => this.bracket_select(value));
        this.bracket_selector.select();
        //Apply functions to the buttons
        document.getElementById("refresh-button").onclick = x => this.bracket_selector.select();
        document.getElementById("delete-button").onclick = x => this.delete();
        document.getElementById("save-button").onclick = x => this.save();
        document.getElementById("download-brackets").onclick = x => this.download();
        document.getElementById("upload-brackets").onclick = x => this.upload();
    }
    bracket_select(value) {
        //Use the "Show" field to select a bracket: new, random, or existing
        if (value === "New Bracket") {
            this.new_bracket();
        }
        else if (value === "Random Bracket") {
            this.random_bracket();
        }
        else {
            this.load_bracket(value);
        }
    }
    delete() {
        //Delete the "Bracket Name" from the user brackets
        let value = this.bracket_name_DOM.value;
        if (value in this.user_brackets) {
            delete this.user_brackets[value];
            this.bracket_selector.set_more_options(Object.keys(this.user_brackets));
            this.set_message("Bracket deleted.");
        }
        else {
            this.set_message("Error Deleting: Bracket name does not exist. Characters must match exactly.");
        }
    }
    save() {
        //Save the "Bracket Name" to the user_brackets
        let user = this.bracket_name_DOM.value;
        var re = /^\w+$/;
        //Make sure the user name is valid
        if (user.length > 10) {
            this.set_message("Error Saving: Bracket name must be 10 characters or less.");
        }
        else if (!re.test(user)) {
            this.set_message("Error Saving: Bracket name can only contain letters, numbers, and underscores.");
        }
        else {
            let sb = this.bracket.convert_to_sparse();
            let valid = true;
            for (let r = 1; r < 7; r++) {
                for (let g = 0; g < 2 ** (6 - r); g++) {
                    if (sb[r][g] === 0) {
                        valid = false;
                    }
                }
            }
            if (valid) {
                //Sparse bracket appears to be valid, save it to the user_brackets
                this.user_brackets[user] = sb;
                this.bracket_selector.set_more_options(Object.keys(this.user_brackets));
                this.set_message("Save complete. Don't forget to download.");
            }
            else {
                this.set_message("Error Saving: Not all selections have been made.");
            }
        }
    }
    download() {
        //Download the current user brackets
        downloadObject(this.user_brackets, "user_brackets");
        this.set_message("Downloading...");
    }
    upload() {
        //Upload a .json file containing user brackets
        //TODO - not yet built
        this.set_message("Error: This function is not yet built.");
    }
    set_message(message) {
        //Set the message area
        this.message_area.textContent = message;
    }
    set_bracket_name(user_name) {
        this.bracket_name_DOM.value = user_name;
    }
    new_bracket() {
        //Load a scratch bracket for in-filling
        this.bracket.clear_winners(true);
        this.set_bracket_name("new");
        this.set_message("Input a bracket name and set winners, then click save.");
    }
    random_bracket() {
        //Create a random bracket using the weights of each team winning a game
        this.bracket.clear_winners(true);
        let sb = this.bracket.generate_random_sparse();
        this.bracket.apply_SparseBracket(sb, true);
        this.set_bracket_name("random");
        this.set_message("Random bracket created based on weights of each team.");
    }
    load_bracket(user_name) {
        //Load a bracket by name
        let sb = this.user_brackets[user_name];
        this.bracket.clear_winners(true);
        this.bracket.apply_SparseBracket(sb, true);
        this.set_bracket_name(user_name);
        this.set_message("Loaded user bracket.");
    }
}
class Selector {
    constructor(selector_id, base_options, more_options, on_change) {
        //Class for easily reading from and updating the selector buttons
        //Will Run the onselect function upon creation
        this.selector_DOM = document.getElementById(selector_id);
        this.on_change_function = on_change;
        this.selector_DOM.onchange = x => this.select();
        this.base_options_DOM = [];
        this.more_options_DOM = [];
        //Add the base options to the selector
        let option_template = document.getElementById("generic-select-option-template");
        for (let option of base_options) {
            let new_option = option_template.cloneNode(true);
            new_option.textContent = option;
            new_option.value = option;
            this.base_options_DOM.push(new_option);
            this.selector_DOM.appendChild(new_option);
        }
        //Add the additional options
        this.set_more_options(more_options);
    }
    set_more_options(more_options) {
        //Delete existing "more options", set new more_options
        //Delete old
        for (let option_DOM of this.more_options_DOM) {
            option_DOM.remove();
        }
        //Add new
        let option_template = document.getElementById("generic-select-option-template");
        for (let option of more_options) {
            let new_option = option_template.cloneNode(true);
            new_option.textContent = option;
            new_option.value = option;
            this.more_options_DOM.push(new_option);
            this.selector_DOM.appendChild(new_option);
        }
        //Run as-if was just selected
        // this.select() -- First selection now must explicitly be called
    }
    select() {
        //Function to run function of current selection
        this.on_change_function(this.selector_DOM.value);
    }
    get_value() {
        return this.selector_DOM.value;
    }
}
class MyChart {
    constructor(div_id) {
        //Class for standard chart setup functions, etc
        this.div_DOM = document.getElementById(div_id);
        this.canvas_DOM = this.div_DOM.getElementsByTagName("canvas")[0];
    }
    generate_labels(num_players) {
        //Function to generate labels in an array
        let arr = ["1st", "2nd", "3rd"];
        for (let i = 3; i < num_players; i++) {
            arr.push((i + 1).toString() + "th");
        }
        return arr.slice(0, num_players);
    }
    get_color(player_num) {
        let colors = ["#DFFF00", "#FFBF00", "#FF7F50", "#DE3163", "#9FE2BF", "#40E0D0", "#6495ED", "#CCCCFF",];
        if (player_num < 8) {
            return colors[player_num];
        }
        else {
            return "#000000"; //black
        }
    }
}
class StackedChart extends MyChart {
    constructor(div_id, scenario) {
        //Create a stacket chart showing each player and their likely finish rank
        super(div_id);
        //Prepare the chart
        this.table = scenario.count_by_rank(); //Table out format not defined
        this.config = {
            type: 'bar',
            data: {
                labels: this.generate_labels(this.table.N),
                datasets: [],
            },
            options: {
                plugins: {
                    legend: { position: "right", reverse: true },
                },
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, max: 100 },
                },
            },
        };
        //Chart it (without any data yet)
        this.chart = new Chart(this.canvas_DOM, this.config);
        //Prepare the selector
        this.selector = new Selector(div_id + "-selector", ["Each Player"], this.table.users, value => this.update_data_for_selection(value));
        //Load the scenario into the chart
        this.load_scenario(scenario);
    }
    update_data_for_selection(value) {
        //Function for updating the table based on the user's selection of data type
        //Clear the existing data
        this.config.data.datasets = [];
        //Write new daata based on selection
        let users;
        if (value === "Each Player") {
            //Show all the data
            users = this.table.users;
        }
        else {
            //Show only the data of the user selected
            users = [value];
        }
        //Create the dataset
        for (let user of users) {
            let ds = {
                label: user,
                data: this.table.get_by_user(user, false),
                backgroundColor: this.get_color(this.table.users.indexOf(user))
            };
            this.config.data.datasets.push(ds);
        }
        this.chart.update();
    }
    load_scenario(scenario) {
        //Update the chart with a new scenario based on user selection of the data_date
        this.table = scenario.count_by_rank();
        this.table.format({ fraction_by: "place", as_percent: true, decimals: 2, string_suffex: "%" });
        //Update the scenario
        this.selector.select();
    }
}
class UpcomingGamesChart extends MyChart {
    constructor(div_id, scenario) {
        //Double column showing change in outcome for an upcoming game
        super(div_id);
        this.height_per_game_multi_user = 16;
        this.height_per_game_single_user = 6;
        //Prepare the chart
        this.table = scenario.count_by_rank();
        this.table.format({ fraction_by: "place", as_percent: true, decimals: 2 });
        this.config = {
            type: 'bar',
            data: {
                // labels: Should be added in the "load function"
                datasets: [],
            },
            options: {
                indexAxis: "y",
                plugins: {
                    legend: { position: "top", reverse: false },
                },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { position: "top" },
                    y: {
                        grid: {
                        //color: Should be set in the loader function
                        },
                    },
                },
            },
        };
        //Chart it (without any data yet)
        this.chart = new Chart(this.canvas_DOM, this.config);
        //Prepare the selector
        this.selector = new Selector(div_id + "-selector", ["Each Player"], this.table.users, value => this.update_for_selection(value) //value isn't actually used, but legacy...
        );
        //Prepare the place selector
        this.selector_place = new Selector(div_id + "-selector-place", [], this.generate_labels(this.table.users.length), value => this.update_for_selection(value) //value isn't actually used, but legacy...
        );
        //Load the provided scenario
        this.load_scenario(scenario);
    }
    update_for_selection(x = undefined) {
        //Function for updating the table based on the user's selection of data
        //x is unused and remains for legacy data declaration reasons, user selection should be read directly
        let selection_value = this.selector.get_value();
        //Clear existing user data & labels
        this.config.data.labels = [];
        this.config.options.scales.y.grid.color = ["black", Chart.defaults.borderColor];
        this.config.data.datasets = [];
        //Create new labels & datasets & gridlines
        for (let subtable of this.tables) {
            //New label
            let row = this.scenario.bracket.state.team_id[subtable.winner_id];
            let label = row.short_team_name;
            let win_percent = subtable.table.count_instances() / this.table.count_instances();
            win_percent *= 100;
            label += " (" + win_percent.toFixed(0) + "%)";
            this.config.data.labels.push(label);
            //Add the gridline
            // this.config.options.scales.y.grid.color.push("red")
            // this.config.options.scales.y.grid.color.push(Chart.defaults.borderColor)
        }
        //New dataset
        //Write new daata based on selection
        let users;
        if (selection_value === "Each Player") {
            //Show all the data
            users = this.table.users;
        }
        else {
            //Show only the data of the user selected
            users = [selection_value];
        }
        //Create the dataset
        //Get the place highlight
        let place_string = this.generate_labels(this.table.users.length);
        let place_focus = place_string.indexOf(this.selector_place.get_value());
        for (let user of users) {
            let deltas = [];
            for (let subtable of this.tables) {
                //Find the difference between the new and the old values, display that
                let new_value = subtable.table.get_by_user(user, false)[place_focus];
                let old_value = this.table.get_by_user(user, false)[place_focus];
                deltas.push(new_value - old_value);
            }
            let ds = {
                label: user,
                data: deltas,
                backgroundColor: this.get_color(this.table.users.indexOf(user))
            };
            this.config.data.datasets.push(ds);
        }
        //Update the chart
        //Change the chart height
        let height;
        if (users.length === 1) {
            height = this.tables.length * this.height_per_game_single_user;
        }
        else {
            height = this.tables.length * this.height_per_game_multi_user;
        }
        this.canvas_DOM.parentElement.style.height = height.toString() + "vmin";
        this.chart.update();
    }
    load_scenario(scenario) {
        //Load a scenario into the chart
        this.scenario = scenario;
        this.table = scenario.count_by_rank();
        this.table.format({ fraction_by: "place", as_percent: true, decimals: 2 });
        this.tables = [];
        //Determine which games are "upcoming"
        for (let r = 1; r < 7; r++) {
            for (let g = 0; g < 2 ** (6 - r); g++) {
                let game = this.scenario.bracket.get_game(r, g);
                //See if both parents have been decided or are undefined & game itself does not have a winner
                let is_upcoming = true;
                for (let parent of game.parent) {
                    //Ensure that both the parent games are decided
                    if (parent !== undefined && parent.winner === undefined) {
                        is_upcoming = false;
                    }
                }
                if (game.winner !== undefined) {
                    //Ensure the game isn't decided
                    is_upcoming = false;
                }
                //Only do things with the upcoming games
                if (is_upcoming) {
                    //Split the scenario into two
                    let new_scenarios = scenario.split(r, g);
                    for (let key in new_scenarios) {
                        //Iterate through the two new scenarios and add tables
                        let new_table = new_scenarios[key].count_by_rank();
                        new_table.format({ fraction_by: "place", as_percent: true, decimals: 2 });
                        this.tables.push({ winner_id: key, table: new_table });
                    }
                }
            }
        }
        //Done with filling out the tables
        //Update the scenario
        this.update_for_selection();
    }
}
//---------------------------------------------------------------
class PageManager {
    constructor(states, dates) {
        //Class that actually loads and manages the page
        this.states = states;
        this.dates = dates;
        this.first_run = true;
    }
    async setup() {
        //Must be called to setup the selector
        this.selector = new Selector("data-date-selector", [], this.dates, //.slice().reverse(),
        //.slice().reverse(),
        date => this.load(date));
        this.selector.select();
    }
    async load(x) {
        //Actually sets up the graphs shown on the page
        //x is not used. This is intentional. Data pulled directly from the appropriate selector
        this.date = this.selector.get_value();
        console.log("Data date selection:", this.date);
        //Load the correct state based on the data date
        let i = this.dates.indexOf(this.date);
        this.state = this.states[i];
        //Main function for loading
        if (this.first_run === true) {
            this.manager = new UserBracketManager(this.state);
            await this.manager.load();
        }
        //Create the current Scenario
        let scenario = new Scenario(this.state, 10000, this.manager.user_brackets);
        console.log(scenario);
        let table = scenario.count_by_rank();
        //Create the charts for the first time if needed
        if (this.first_run === true) {
            this.first_run = false;
            //Create the stacked chart
            this.stackedChart = new StackedChart("stacked-chart-div", scenario);
            //Play with the upcoming games
            this.upcomingChart = new UpcomingGamesChart("upcoming-game-div", scenario);
        }
        else {
            //Re-load the charts with data
            this.stackedChart.load_scenario(scenario);
            this.upcomingChart.load_scenario(scenario);
        }
    }
}
async function main() {
    //Load the primary csv File and convert to states
    let text = await load_file_text(".//fivethirtyeight_ncaa_forecasts.csv"); //Testing
    // let text: string = await load_file_text("https://projects.fivethirtyeight.com/march-madness-api/2022/fivethirtyeight_ncaa_forecasts.csv") //Production
    let csv = csvToArray2(text);
    let ret = breakdown_dates(csv);
    let states = ret[0];
    let dates = ret[1];
    //Create the PageManager
    let pm = new PageManager(states, dates);
    await pm.setup();
}
main();
//# sourceMappingURL=builder.js.map