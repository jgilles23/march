//Frequently changed constants
const primarySimulations = 10 ** 2;
const secondarySimulations = Math.floor(primarySimulations / 10);
const seedString = "march madness";
//Never changed constants
const scoreByRound = [0, 10, 20, 40, 80, 160, 320];
//Game 63 contains 64 probabilities
//HELPER FUNCTIONS
//Random number generator
//https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function sfc32(a, b, c, d) {
    return function () {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    };
}
// Create cyrb128 state:
var seed = cyrb128(seedString);
// Four 32-bit component hashes provide the seed for sfc32.
var rand = sfc32(seed[0], seed[1], seed[2], seed[3]);
//Function to choose an items from a probability distribution
function chooseItem(probabilityDistribution) {
    //Choose item from a probability distribution
    //sumcheck normalizes the probability distribution
    // let sumCheck = 0
    // for (let p of probabilityDistribution) {
    //     sumCheck += p
    // }
    //Actually choose an item
    let r = rand(); // *sumCheck //normalized probability distribution
    let sum = 0;
    for (let i = 0; i < probabilityDistribution.length; i++) {
        sum += probabilityDistribution[i];
        if (r < sum) {
            return i;
        }
    }
    //random number is larger than the sum --- shoud be very very rare - and caught by the disableable check above
    return probabilityDistribution.length - 1;
}
// DEFINE GAME STRUCTURE
const divisor = [0, 2, 4, 8, 16, 32, 64];
const base = [0, 1, 33, 49, 57, 61, 63];
const gameToRound = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6];
function getGame(team, round) {
    // Get tournament game number give team number and round number
    if (team <= 0 || team > 64) {
        throw "Team number outside of expected bounds";
    }
    return Math.floor((team - 1) / divisor[round] + base[round]);
}
function getRound(game) {
    // Get tournamento round number given game number
    return gameToRound[game];
}
function getFirstTeam(game) {
    //Get first team in a game
    const round = getRound(game);
    return (game - base[round]) * divisor[round] + 1;
}
function getTeams(game) {
    //Get all teams in a game
    let teams = [];
    let firstTeam = getFirstTeam(game);
    for (let t = firstTeam; t < firstTeam + getNumTeams(game); t++) {
        teams.push(t);
    }
    return teams;
}
function getNumTeams(game) {
    //Get the number of teams in each game of a round
    return divisor[gameToRound[game]];
}
function nextGame(game) {
    return getGame(getFirstTeam(game), getRound(game) + 1);
}
function previousGames(game) {
    if (game < base[2]) {
        return [NaN, NaN];
    }
    let firstGame = getGame(getFirstTeam(game), getRound(game) - 1);
    return [firstGame, firstGame + 1];
}
function getTeamPositionInGame(game, team) {
    //0 indexed; return position within a game
    return team - getFirstTeam(game);
}
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
            short_team_name: "",
        };
        return object;
    });
    return arr; // return the array
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
function parse538csv(csv, teams) {
    // Return array games with associated probablities for each team by date
    let probabilitiesByDate = {};
    for (let item of csv) {
        //Exclude womens tournament
        if (item["gender"] !== 'mens') {
            continue;
        }
        //Check if the date has been used before
        let probabilityArray;
        for (let date in probabilitiesByDate) {
            if (item["forecast_date"] === date) {
                probabilityArray = probabilitiesByDate[date];
            }
        }
        //Date not found, createas a probabilityArray
        if (probabilityArray === undefined) {
            probabilityArray = Array(64);
            for (let i = 1; i < 64; i++) {
                probabilityArray[i] = Array(getNumTeams(i)).fill(0);
            }
            probabilitiesByDate[item["forecast_date"]] = probabilityArray;
        }
        //Find matching team
        const regionLookup = { "South": 33, "East": 17, "Midwest": 49, "West": 1 };
        let teamID = Math.floor(item["team_slot"] / 2) % 16 + regionLookup[item["team_region"]];
        let team = teams[teamID];
        //Assign probailities
        for (let i = 1; i <= 6; i++) {
            let game = getGame(teamID, i);
            probabilityArray[game][getTeamPositionInGame(game, teamID)] += item["rd_win"][i]; //Plus equals to account for play in
        }
    }
    //Return the parsed data
    return probabilitiesByDate;
}
class Scenario2 {
    constructor(probTable, brackets) {
        // Class used to easily calculate scenarios and apply those scenarios to user brackets - graphs are then produced using this data
        this.probTable = probTable;
        this.brackets = brackets;
        this.simulations = [];
        this.scores = {};
        this.places = {};
        for (let user in brackets) {
            this.scores[user] = [];
            this.places[user] = [];
        }
        this.calculateSimulations(secondarySimulations);
        console.log(this.scores);
        console.log(this.places);
    }
    calculateSimulations(n) {
        //calculate until there are n simulations; if n already met, do nothing
        while (this.simulations.length < n) {
            this.addSimulation();
        }
    }
    addSimulation() {
        //Add a simulation to the simulations list by iterating through the probability table and creating sub-games
        let simulaiton = new Array(64);
        for (let game = 63; game > 0; game--) {
            if (simulaiton[game] !== undefined) {
                //Skip games where the winner has already been selected
                continue;
            }
            //Probabilities are not adjusted based on the winner of the next game -> That's the assumption we are just going to make here
            let winner = chooseItem(this.probTable[game]) + getFirstTeam(game);
            let round = getRound(game);
            let g = game;
            while (round > 0) {
                simulaiton[g] = winner;
                round -= 1;
                g = getGame(winner, round);
            }
        }
        //Add simulation to the simulations list
        this.simulations.push(simulaiton);
        //Calculate score per user
        let allScores = [];
        for (let user in this.brackets) {
            let score = 0;
            for (let game = 1; game <= 63; game++) {
                if (this.brackets[user][game] === simulaiton[game]) {
                    score += scoreByRound[getRound(game)];
                }
            }
            this.scores[user].push(score);
            allScores.push(score);
        }
        //Calculate the position per user --- Apportion Ties Randomly --- points in a tie are split between the players
        allScores.sort();
        for (let user in this.brackets) {
            let score = this.scores[user][this.scores[user].length - 1];
            let positions = [];
            for (let i = 1; i <= allScores.length; i++) {
                if (score === allScores[i - 1]) {
                    positions.push(i);
                }
            }
            //If there is a tie for position, assign a random position from the bunch
            if (positions.length === 1) {
                this.places[user].push(positions[0]);
            }
            else {
                let r = Math.floor(rand() * positions.length);
                this.places[user].push(positions[r]);
            }
        }
    }
}
// require(".//team_data.json")
// require(".//fivethirtyeight_ncaa_forecasts.csv")
async function main2() {
    //Load the teams data
    let teams = await load_file_json("https://jgilles23.github.io/march/team_data.json");
    //Load the primary csv File and convert to states
    let text = await load_file_text("https://jgilles23.github.io/march/fivethirtyeight_ncaa_forecasts.csv"); //Testing
    // let text: string = await load_file_text("https://projects.fivethirtyeight.com/march-madness-api/2022/fivethirtyeight_ncaa_forecasts.csv") //Production
    let csv = csvToArray(text);
    let probabilitiesByDate = parse538csv(csv, teams);
    // load user bracket selections
    let backetsByUser = await load_file_json("https://jgilles23.github.io/march/user_brackets_new.json");
    //Create a scenario per date
    new Scenario2(probabilitiesByDate["2022-03-13"], backetsByUser);
}
main2();
//# sourceMappingURL=builder2.js.map