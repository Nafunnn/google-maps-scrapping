import readline from "readline";

/**
 * Prompts the user for input via the terminal.
 * @returns A promise that resolves to an array of strings (queries entered by the user).
 */
export const promptUser = () => {
  return new Promise<string[]>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question("Enter the query: ", (answer) => {
      resolve(answer.split(",").map((item) => item.trim()));
      rl.close();
    });
  });
};

/**
 * Prompts the user for a choice via the terminal.
 * @param data - An object containing the question to ask.
 * @returns A promise that resolves to the user's choice.
 */
export const promptChoise = (data: { question: string }) => {
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question(data.question, (choice) => {
      resolve(choice);
      rl.close();
    });
  });
};

/**
 * Deletes a query from the list of queries.
 * @param query - An array of queries.
 * @returns A promise that resolves to the updated array of queries.
 */
export const deleteQuery = (query: string[]) => {
  return new Promise<string[]>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\nList Query ----");

    query.forEach((item, index) => console.log(`${index + 1}. ${item}`));
    console.log(`0. Cancel Remove Query`);

    rl.question("Enter the number: ", (answer) => {
      if (answer === "0") console.log("Cancel Remove Query\n");
      else if (parseInt(answer) > query.length) console.log("Number not found\n");
      else query.splice(parseInt(answer) - 1, 1);
      resolve(query);
      rl.close();
    });
  });
};
