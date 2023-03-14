console.log("hello world")

interface Team {
    teamID: number
    sportsID: number
    seed: number
    abbreviation: string
    name: string
}

// DEFINE BEFORE AND AFTER FOR GAMES
const divisor = [0, 2, 4, 8, 16, 32, 64]
const base = [0, 1, 33, 49, 57, 61, 63]
const gameToRound = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6]

function getGame(team: number, round: number) {
    // Get tournament game number give team number and round number
    if (team <= 0 || team > 64) {
        throw "Team number outside of expected bounds"
    }
    return Math.floor((team - 1) / divisor[round] + base[round])
}
function getRound(game: number) {
    // Get tournamento round number given game number
    return gameToRound[game]
}
function getFirstTeam(game: number) {
    //Get first team in a game
    const round = getRound(game)
    return (game - base[round]) * divisor[round] + 1
}
function getTeams(game: number) {
    //Get all teams in a game
    let teams = []
    let firstTeam = getFirstTeam(game)
    for (let t = firstTeam; t < firstTeam + divisor[gameToRound[game]]; t++) {
        teams.push(t)
    }
    return teams
}
function nextGame(game: number) {
    return getGame(getFirstTeam(game), getRound(game) + 1)
}
function previousGames(game: number) {
    if (game < base[2]) {
        return [NaN, NaN]
    }
    let firstGame = getGame(getFirstTeam(game), getRound(game) - 1)
    return [firstGame, firstGame + 1]
}

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
            short_team_name: "",
        }
        return object;
    });
    return arr; // return the array
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

function parse538csv(csv: Array<Object>, teams: Array<Team>) {
    
}


class Scenario2 {
    probList: Array<number>
    simulations: Array<number>
    constructor(probTable: Array<Array<any>>, teams: Array<Team>) {

    }
}

require(".//team_data.json")
require(".//fivethirtyeight_ncaa_forecasts.csv")

async function main2() {
    //Load the teams data
    let teams: Array<Team> = await load_file_json(".//team_data.json")
    console.log(teams)
    //Load the primary csv File and convert to states
    let text: string = await load_file_text(".//fivethirtyeight_ncaa_forecasts.csv") //Testing
    // let text: string = await load_file_text("https://projects.fivethirtyeight.com/march-madness-api/2023/fivethirtyeight_ncaa_forecasts.csv") //Production
    let csv = csvToArray(text)
    console.log(csv)
}

main2()