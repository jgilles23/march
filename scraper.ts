// ESPN Scraper
const cheerio = require('cheerio');
const fs = require('fs');

interface Team {
    teamID: number
    sportsID: number
    seed: number
    abbreviation: string
    name: string
}

const brackets = {
    "Tyler" : "https://fantasy.espn.com/tournament-challenge-bracket/2022/en/entry?entryID=63497066",
    "Jordan" : "https://fantasy.espn.com/tournament-challenge-bracket/2022/en/entry?entryID=67990401",
    "Neel" : "https://fantasy.espn.com/tournament-challenge-bracket/2022/en/entry?entryID=68360536",
}

async function main_scraper() {
    let allBrackets = {}
    let teams
    for (let player in brackets) {
        let ret = await scrape_bracket(brackets[player])
        let selections = ret.selections
        allBrackets[player] = selections
        teams = ret.teams
        console.log(player, JSON.stringify(selections))
    }
    fs.writeFileSync("user_brackets_new.json", JSON.stringify(allBrackets))
    fs.writeFileSync("team_data.json", JSON.stringify(teams))
    console.log("Data write complete.")
}

async function scrape_bracket(url: string) {
    // Pull the webpage and get the html
    const resp = await fetch(url);
    const responsetext = await resp.text();
    //Load to jQuery similar file using cheerio
    const $ = cheerio.load(responsetext);
    //Pull data round by round
    let roundNumber = 0
    let gamesPerRound = [32, 16, 8, 4, 2, 1]
    let gameNumber = 0
    let gameInRoundNumber = 0
    let selections = [0]
    let teams = {}
    while (true) {
        // Determine the game number and the round number: gameNumber, roundNumber
        gameNumber += 1
        gameInRoundNumber += 1
        if (gameInRoundNumber > gamesPerRound[roundNumber]) {
            // Move to the next round
            roundNumber += 1
            gameInRoundNumber = 1
            // End after the finals
            if (roundNumber >= gamesPerRound.length) {
                break
            }
        }
        // Pull selection data
        let matchup = $(`.matchup.m_${gameNumber}`)
        for (let s = 1; s <= 2; s++) {
            let slot = matchup.find(`.slot.s_${s}`)
            let team: Team = {
                teamID: parseInt(slot.children().first().attr("data-id")),
                sportsID: parseInt(slot.children().first().attr("data-sportsid")),
                seed: parseInt(slot.find(".seed").text()),
                abbreviation: slot.find(".abbrev").first().text(),
                name: slot.find(".name").first().text(),
            }
            // Did player select team to advance
            let selectedToAdvance: Boolean = slot.find(".selectedToAdvance").length > 0
            if (selectedToAdvance) {
                selections.push(team.teamID)
            }
            //In the first round, create data for all teams 
            if (roundNumber === 0) {
                teams[team.teamID] = team
            }
        }
    }
    // Data pull loop complete return selections and teams
    // console.log(selections)
    // console.log(teams)
    return {selections: selections, teams:teams}
}

main_scraper();
//# sourceMappingURL=scraper.js.map