console.log("start");
function csvToArray(str, delimiter = ",") {
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
                even_row.team_rating = Math.max(even_row.team_rating, odd_row.team_rating); //Take best rating
                for (let i = 0; i < 7; i++) {
                    even_row.rd_win[i] += odd_row.rd_win[i]; //Combine win %
                }
                //Remove the odd row
                this.team_slot.delete(odd_slot);
            }
        }
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
    for (let date of dates) {
        states_arr.push(states[date]);
    }
    return states_arr;
}
class Game {
    constructor(round_num, game_num, bracket) {
        //Create a game
        this.bracket = bracket;
        this.round_num = round_num;
        this.game_num = game_num;
        //Pull teams in round 1
        if (round_num === 1) {
            this.team = this.bracket.get_teams(this.round_num, this.game_num);
        }
        else {
            this.team = [undefined, undefined];
        }
        //Pre-set game winner
        this.winner_ind = undefined;
        this.winner = undefined;
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
        let inputs = this.selector.getElementsByTagName("input"); //radio button
        this.labels = this.selector.getElementsByTagName("label"); //label
        for (let i = 0; i < 2; i++) {
            //Change the radio button name and ids
            let inp = inputs[i];
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
        for (let i = 0; i < 2; i++) {
            if (this.team[i] === undefined) {
                this.labels[i].textContent = "-";
            }
            else {
                this.labels[i].textContent = this.team[i].team_name.toString();
            }
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
    }
}
//---------------------------------------------------------------
//Load the primary csv
fetch(".//fivethirtyeight_ncaa_forecasts.csv").then(response => {
    let reader = response.text()
        .then(text => {
        main(text);
    });
});
//Breakout of the .then cycle to make the code more readable 
function main(text) {
    //Convert csv string to array
    let csv = csvToArray(text);
    //Convert att to an array of states, one for each forecast date
    let states = breakdown_dates(csv);
    //Create a bracket of all data for the intial state
    let initial_bracket = new Bracket(states[0]);
    console.log(initial_bracket);
    //Push bracket to the DOM
    initial_bracket.create_DOM("bracket-input");
}
//# sourceMappingURL=builder.js.map