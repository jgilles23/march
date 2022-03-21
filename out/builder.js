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
    // return the array
    return arr;
}
class CSV {
    constructor(csvArray) {
        //Class to allow common functions to be applied to the csvData
        this.data = csvArray;
        this.dates = this.unique_dates();
    }
    unique(attribute, sorted = false, reversed = false) {
        if (!(attribute in this.data[0])) {
            throw new Error("Attribute not defined: " + attribute);
        }
        const s = new Set();
        for (let d of this.data) {
            s.add(d[attribute]);
        }
        let arr = Array.from(s);
        if (sorted && !reversed) {
            return arr.sort();
        }
        if (reversed) {
            return arr.sort().reverse();
        }
        return arr;
    }
    unique_dates() {
        const s = new Set();
        for (let d of this.data) {
            s.add(d.forecast_date);
        }
        return Array.from(s).sort();
    }
    getSingle() {
        //Get a single value from the CSV file by search through the csv
        //If multiple instances exist, it will return the first instance
    }
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
    console.log(states);
}
function main(text) {
    let csv = csvToArray(text);
    console.log(csv);
    breakdown_dates(csv);
}
fetch(".//fivethirtyeight_ncaa_forecasts.csv").then(response => {
    let reader = response.text()
        .then(text => {
        main(text);
    });
});
console.log("end");
//# sourceMappingURL=builder.js.map