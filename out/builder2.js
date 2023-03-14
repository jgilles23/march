//Frequently changed constants
const primarySimulations = 10 ** 4;
const secondarySimulations = Math.floor(primarySimulations / 10);
const seedString = "march madness";
const height_base = 20;
const height_per_game_single_user = 3;
const height_per_game_multi_user = 5;
const userSelectorID = "user-selector";
//Never changed constants
const scoreByRound = [0, 10, 20, 40, 80, 160, 320];
//Game 63 contains 64 probabilities
//HELPER FUNCTIONS
function sortDescending(numbers) {
    //Sort numbers in a list
    return numbers.sort(function (a, b) {
        return b - a;
    });
}
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
function getNumberOfGamesInRound(round) {
    return 64 / divisor[round];
}
function csvToArray3(str, delimiter = ",") {
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
async function load_file_json2(filepath) {
    //Load a file and convert to object using json
    let response = await fetch(filepath);
    let obj = await response.json();
    return obj;
}
async function load_file_text2(filepath) {
    //Load a file and convert to text
    let response = await fetch(filepath);
    let text = await response.text();
    return text;
}
function parse538csv(csv) {
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
        //Assign probailities
        for (let i = 1; i <= 6; i++) {
            let game = getGame(teamID, i);
            probabilityArray[game][getTeamPositionInGame(game, teamID)] += item["rd_win"][i]; //Plus equals to account for play in
        }
    }
    //Return the parsed data
    return probabilitiesByDate;
}
//DATA ANALYSIS FUNCTIONS
function mean(data) {
    // Takes the average of an array of numbers
    // Returns 0 if no data provided
    if (data.length === 0) {
        return 0;
    }
    let sum = 0;
    for (let x of data) {
        sum += x;
    }
    return sum / data.length;
}
function histogram(data, applySuffix, categories) {
    // Returns a histogram object of an array of numbers --- normalized out of 1
    // If suffixFlag is true 1 -> 1st, 2 -> 2nd, etc.
    // If categories are provided will align each number to the NEAREST category
    let histogram = {};
    if (categories !== undefined) {
        for (let category of categories) {
            if (applySuffix === true) {
                histogram[addNumberSuffix(category)] = 0;
            }
            else {
                histogram[category] = 0;
            }
        }
    }
    for (let x of data) {
        let y = x;
        if (applySuffix === true) {
            y = addNumberSuffix(x);
        }
        //Add to the count of the histogram
        if (y in histogram) {
            histogram[y] += 1 / data.length;
        }
        else if (categories === undefined) {
            histogram[y] = 1 / data.length;
        }
        else {
            throw "Category not defined when trying to add data.";
        }
    }
    return histogram;
}
// STRING MANIPULATION FUNCTIONS
function addNumberSuffix(num) {
    if (num === 1) {
        return "1st";
    }
    else if (num === 2) {
        return "2nd";
    }
    else if (num === 3) {
        return "3rd";
    }
    else {
        return num.toString() + "th";
    }
}
class Scenario2 {
    constructor(probTable, brackets, date) {
        // Class used to easily calculate scenarios and apply those scenarios to user brackets - graphs are then produced using this data
        this.probTable = probTable;
        this.date = date;
        this.brackets = brackets;
        this.simulations = [];
        this.scores = {};
        this.places = {};
        for (let user in brackets) {
            this.scores[user] = [];
            this.places[user] = [];
        }
        this.calculateSimulations(secondarySimulations);
    }
    calculateSimulations(n) {
        //calculate until there are n simulations; if n already met, do nothing
        while (this.simulations.length < n) {
            this.generateSimulation();
        }
    }
    generateSimulation() {
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
        allScores = sortDescending(allScores);
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
    possibleWinners(game) {
        //Returns sorted array of possible winners for a given game (look at percents in  prob table)
        let possibleWinners = [];
        for (let i = 0; i < this.probTable[game].length; i++) {
            if (this.probTable[game][i] > 0) {
                possibleWinners.push(getFirstTeam(game) + i);
            }
        }
        //Should automatically be sorted
        return possibleWinners;
    }
    splitByGameWinner(data, game) {
        // Split the dataset into new arrays mapped to the game winners
        // Provide game number
        // Used to split average position finish by the game winner for each game
        if (this.simulations.length !== data.length) {
            throw "Simulations and provided data must have the same length";
        }
        //Establish splitdata output
        let splitData = new Map();
        //Establish possible winners
        for (let winner of this.possibleWinners(game)) {
            splitData[winner] = [];
        }
        //Assign to data set based on those wins
        for (let i = 0; i < this.simulations.length; i++) {
            let winner = this.simulations[i][game];
            splitData[winner].push(data[i]);
        }
        return splitData;
    }
    isGameDecided(game) {
        // Returns a flag if the provided game is already decided in the provided data set
        for (let p of this.probTable[game]) {
            if (p === 1) {
                return true;
            }
        }
        return false;
    }
    averagePlaceByUser() {
        let averagePlaceByUser = new Map();
        for (let user in this.brackets) {
            averagePlaceByUser[user] = mean(this.places[user]);
        }
        return averagePlaceByUser;
    }
}
class MyChart2 {
    constructor(div_id, selector_id, scenario, teams) {
        //Class for standard chart setup functions, etc
        this.div_DOM = document.getElementById(div_id);
        this.canvas_DOM = this.div_DOM.getElementsByTagName("canvas")[0];
        this.scenario = scenario;
        this.teams = teams;
        //Prepare the selector
        this.selectorDOM = document.getElementById(selector_id);
    }
    updateScenario(scenario) {
        //Change the scenario when the user does something that would change the requested scenario
        this.scenario = scenario;
        this.load();
    }
    get_color(user) {
        let i = 0;
        for (let u in this.scenario.brackets) {
            if (user === u) {
                break;
            }
            i += 1;
        }
        let colors = ["#DFFF00", "#FFBF00", "#FF7F50", "#DE3163", "#9FE2BF", "#40E0D0", "#6495ED", "#CCCCFF",];
        if (i < colors.length) {
            return colors[i];
        }
        else {
            return "#000000"; //black
        }
    }
    getUsersFromSelector() {
        let selectedValue = this.selectorDOM.value;
        let users = [];
        if (selectedValue === "Each Player") {
            for (let user in this.scenario.brackets) {
                users.push(user);
            }
        }
        else {
            users.push(selectedValue);
        }
        return users;
    }
    load() {
        throw "Load Must be Implemented by sub-class";
    }
    formatUserWithPlace(user) {
        return `${user} (${mean(this.scenario.places[user]).toFixed(1)})`;
    }
    formatUserWithScore(user) {
        return `${user} (${mean(this.scenario.scores[user]).toFixed(0)})`;
    }
    formatTeamLong(teamID, game) {
        let x = getTeamPositionInGame(game, teamID); //Team position in the game
        return `${this.teams[teamID].seed} ${this.teams[teamID].name} (${(this.scenario.probTable[game][x] * 100).toFixed(0)}%)`;
    }
}
class StackedChart2 extends MyChart2 {
    constructor(scenario, teams) {
        //Create a stacket chart showing each player and their likely finish rank
        super("stacked-chart-div", userSelectorID, scenario, teams);
        //Prepare the chart
        this.config = {
            type: 'bar',
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                plugins: {
                    legend: { position: "top", reverse: true },
                },
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, max: 1 },
                },
            },
        };
        //Chart it (without any data yet)
        this.chart = new Chart(this.canvas_DOM, this.config);
        //Load the initial data
        this.load();
    }
    load() {
        // Load the scenario into the chat & display
        // Show only the selected data
        let users = this.getUsersFromSelector();
        // Add data
        // this.config.data.labels = users
        this.config.data.datasets = [];
        for (let user of users) {
            this.config.data.labels = [];
            let numUsers = Object.keys(this.scenario.brackets).length;
            let categories = [];
            for (let i = 1; i <= numUsers; i++) {
                categories.push(i);
            }
            this.config.data.datasets.push({
                label: this.formatUserWithPlace(user),
                data: histogram(this.scenario.places[user], true, categories),
                backgroundColor: this.get_color(user)
            });
        }
        this.chart.update();
    }
}
class ScoreHistorgramChart extends MyChart2 {
    constructor(scenario, teams) {
        // Chart for displaying histogram of the player score at the current state
        // Likely to be overloaded with all players showing
        // May need to bucket scores when all players are active...
        super("scores-histogram-chart-div", userSelectorID, scenario, teams);
        this.config = {
            type: 'bar',
            data: {
                datasets: [],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top', reverse: true
                    },
                }
            },
        };
        // Load the chart with no data
        this.chart = new Chart(this.canvas_DOM, this.config);
        //Load the initial data
        this.load();
    }
    load() {
        // Load the scenario into the chat & display
        let users = this.getUsersFromSelector();
        // Add data
        this.config.data.datasets = [];
        for (let user of users) {
            this.config.data.labels = [];
            let numUsers = Object.keys(this.scenario.brackets).length;
            let categories = [];
            for (let i = 1; i <= numUsers; i++) {
                categories.push(i);
            }
            this.config.data.datasets.push({
                label: this.formatUserWithScore(user),
                data: histogram(this.scenario.scores[user], false),
                backgroundColor: this.get_color(user)
            });
        }
        this.chart.update();
    }
}
class GameChart extends MyChart2 {
    constructor(scenario, teams) {
        // Class for gaphing upcoming games with bars for effect on
        // Players average finishing place in the tournament
        super("upcoming-game-div", userSelectorID, scenario, teams);
        this.config = {
            type: 'bar',
            data: {
                // labels: Should be added in the "load function"
                datasets: [],
            },
            options: {
                indexAxis: "y",
                plugins: {
                    legend: { position: "top", reverse: true },
                },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { position: "top" },
                    y: {
                        grid: {
                            color: ["black", Chart.defaults.borderColor]
                        },
                    },
                },
            },
        };
        //Chart it (without any data yet)
        this.chart = new Chart(this.canvas_DOM, this.config);
        //Load the first round of data
        this.load();
    }
    load() {
        //Load the saved scenario into the chart
        this.config.data.datasets = []; //Clear the current dataset
        this.config.data.labels = [];
        let averagePlaceByUser = this.scenario.averagePlaceByUser();
        //Determine the upcomming games & Split data
        let users = this.getUsersFromSelector();
        let firstUserFlag = true;
        for (let user of users) {
            // Pre-render the data set for this user
            let userDataSet = {
                label: this.formatUserWithPlace(user),
                data: [],
                backgroundColor: this.get_color(user)
            };
            //Iterate through each game
            for (let round = 1; round <= 6; round++) {
                let foundUndecidedFlag = false;
                for (let i = 0; i < getNumberOfGamesInRound(round); i++) {
                    let game = base[round] + i;
                    if (this.scenario.isGameDecided(game) === true) {
                        continue;
                    }
                    // Stall on the undecided games in the round
                    foundUndecidedFlag = true;
                    // Establish overall labels for the teams
                    if (firstUserFlag === true) {
                        for (let winner of this.scenario.possibleWinners(game)) {
                            this.config.data.labels.push(this.formatTeamLong(winner, game));
                        }
                    }
                    // Push data to dataset
                    let splitPlace = this.scenario.splitByGameWinner(this.scenario.places[user], game);
                    for (let winner of this.scenario.possibleWinners(game)) {
                        let m = mean(splitPlace[winner]);
                        if (m === 0) {
                            userDataSet.data.push(0);
                        }
                        else {
                            userDataSet.data.push(m - averagePlaceByUser[user]);
                        }
                    }
                }
                //Break once current round calculation is complete
                if (foundUndecidedFlag === true) {
                    break;
                }
            }
            //Unset first user
            firstUserFlag = false;
            // Add data set to the model
            this.config.data.datasets.push(userDataSet);
        }
        //Change the chart height
        let height;
        if (users.length === 1) {
            height = this.config.data.labels.length * height_per_game_single_user + height_base;
        }
        else {
            height = this.config.data.labels.length * height_per_game_multi_user + height_base;
        }
        this.canvas_DOM.parentElement.style.height = height.toString() + "vmin";
        // Update the chart
        this.chart.update();
    }
}
class LineTimeChart extends MyChart2 {
    constructor(div_id, scenarios, mostRecentScenario, teams) {
        //Create a line chart of the average finishing score of the player over time
        super(div_id, userSelectorID, mostRecentScenario, teams);
        this.scenarios = scenarios;
        //Prepare the chart
        this.config = {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        reverse: true
                    },
                }
            },
        };
        //Chart it (without any data yet)
        this.chart = new Chart(this.canvas_DOM, this.config);
        // Load the chart
        this.load();
    }
    load() {
        this.config.data.datasets = [];
        this.config.data.labels = [];
        let firstUserFlag = true;
        for (let user of this.getUsersFromSelector()) {
            // Create a data set for each user
            let userDataSet = {
                label: this.formatUser(user),
                data: [],
                backgroundColor: this.get_color(user),
                borderColor: this.get_color(user)
            };
            //Reverse the dates
            let reverseDates = [];
            for (let date in this.scenarios) {
                reverseDates.unshift(date);
            }
            // Iterate through each date to pull the average score
            for (let date of reverseDates) {
                // Push labels for the first user
                if (firstUserFlag === true) {
                    this.config.data.labels.push(date);
                }
                userDataSet.data.push(this.calcMetric(date, user));
            }
            firstUserFlag = false;
            this.config.data.datasets.push(userDataSet);
        }
        //Update the chart
        this.chart.update();
    }
    calcMetric(date, user) {
        throw "calcMetric must be implemented by sub-classes.";
    }
    formatUser(user) {
        throw "formatUser must be implemented by sub-classes";
    }
}
class ScoreChart extends LineTimeChart {
    // Shows score over time
    calcMetric(date, user) {
        return mean(this.scenarios[date].scores[user]);
    }
    formatUser(user) {
        return this.formatUserWithScore(user);
    }
}
class PlaceOverTimeChart extends LineTimeChart {
    // Shows average place over time
    calcMetric(date, user) {
        return mean(this.scenarios[date].places[user]);
    }
    formatUser(user) {
        return this.formatUserWithPlace(user);
    }
}
async function main2() {
    //Load the teams data
    let teams = await load_file_json2("https://jgilles23.github.io/march/team_data.json");
    //Load the primary csv File and convert to states
    let text = await load_file_text2("https://jgilles23.github.io/march/fivethirtyeight_ncaa_forecasts.csv"); //Testing
    // let text: string = await load_file_text2("https://projects.fivethirtyeight.com/march-madness-api/2022/fivethirtyeight_ncaa_forecasts.csv") //Production
    let csv = csvToArray3(text);
    let probabilitiesByDate = parse538csv(csv);
    // load user bracket selections
    let backetsByUser = await load_file_json2("https://jgilles23.github.io/march/user_brackets_new.json");
    //Add users to the selector
    let userSelectorDOM = document.getElementById(userSelectorID);
    let option = document.createElement("option");
    userSelectorDOM.add(option);
    option.textContent = "Each Player";
    option.value = "Each Player";
    for (let user in backetsByUser) {
        option = document.createElement("option");
        userSelectorDOM.add(option);
        option.textContent = user;
        option.value = user;
    }
    // Add data date to a selector
    let dataDateSelectorDOM = document.getElementById("data-date-selector");
    for (let date in probabilitiesByDate) {
        option = document.createElement("option");
        dataDateSelectorDOM.add(option);
        option.textContent = date;
        option.value = date;
    }
    //Create a scenario per date
    let scenarioByDate = new Map();
    for (let date in probabilitiesByDate) {
        scenarioByDate[date] = new Scenario2(probabilitiesByDate[date], backetsByUser, date);
    }
    //Get the most recent date
    let mostRecentDate = "";
    for (let date in probabilitiesByDate) {
        mostRecentDate = date;
        break;
    }
    //Create a stacked chart
    let stackedChart = new StackedChart2(scenarioByDate[mostRecentDate], teams);
    //Create GameChart
    let gameChart = new GameChart(scenarioByDate[mostRecentDate], teams);
    //Create Score over time chart
    let scoreChart = new ScoreChart("score-chart-div", scenarioByDate, scenarioByDate[mostRecentDate], teams);
    //Create Place over time chart
    let placeChart = new PlaceOverTimeChart("place-chart-div", scenarioByDate, scenarioByDate[mostRecentDate], teams);
    //Create Score Histogram Chart
    let scoreHistogramChart = new ScoreHistorgramChart(scenarioByDate[mostRecentDate], teams);
    //Add click action to the main selector - Select all players or only one player
    userSelectorDOM.onchange = x => {
        stackedChart.load();
        gameChart.load();
        scoreChart.load();
        placeChart.load();
        scoreHistogramChart.load();
    };
    //Add click to data date selector - Select something other than the most recent data date
    dataDateSelectorDOM.onchange = x => {
        let dataDate = dataDateSelectorDOM.value;
        let newScenario = scenarioByDate[dataDate];
        stackedChart.updateScenario(newScenario);
        scoreHistogramChart.updateScenario(newScenario);
        gameChart.updateScenario(newScenario);
        //Create filtered scenarios to the new Data Date
        let newScenarios = new Map();
        scoreChart.updateScenario(newScenario);
        placeChart.updateScenario(newScenario);
    };
}
main2();
//# sourceMappingURL=builder2.js.map