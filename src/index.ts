import { promptUser, promptChoise, deleteQuery } from "./utility/helpers";
import { getData } from "./services/browserService";
import { createFile } from "./utility/fileOperations";

const main = async () => {
  while (true) {
    let query: string[] = [];

    while (true) {
      query.push(...(await promptUser()));
      console.log(query);

      const choice = await promptChoise({ question: "\n1. Remove Query\n2. Continue Input Query\n3. Stop Input Query\nType your query to continue\nYour Answer: " });
      if (choice === "1") query = await deleteQuery(query);
      else if (choice === "2") continue;
      else if (choice === "3") break;
      console.log(query);
    }

    let choiseOutput: "1" | "2";
    while (true) {
      choiseOutput = await promptChoise({ question: "\nFile Output?\n1. CSV File\n2. JSON File\nYour Choice: " }) as "1" | "2";
      if (choiseOutput === "1" || choiseOutput === "2") break
      else console.log("Invalid Input. Try Again!");
    }

    for (const queryData of query) createFile(await getData(queryData), choiseOutput === "1" ? "csv" : "json");
    if ((await promptChoise({ question: "\nUse Again Process?\n1. Yes\n2. Stop\nYour Choice: " })) !== "1") break;
  }
};

main();
