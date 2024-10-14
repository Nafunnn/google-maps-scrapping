import * as cheerio from "cheerio";
import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import * as fs from "fs";
import * as path from "path";
import readline from "readline";

// Function to get Google Maps data
async function getGoogleMapsData(query) {
  // Use plugin
  puppeteerExtra.use(stealthPlugin());

  // Launch browser
  const browser = await puppeteerExtra.launch({ headless: false }); // headless false to show the window
  const page = await browser.newPage();

  try {
    // Go to this page
    await page.goto(`https://www.google.com/maps/search/${query.split(" ").join("+")}`);

    // Scroll to Last
    async function autoScroll(page) {
      await page.evaluate(async () => {
        // Element Scrollable Area (List of Location)
        const wrapper = document.querySelector('div[role="feed"]');

        await new Promise((resolve, reject) => {
          let totalHeight = 0;
          let distance = 1000;
          let scrollDelay = 3000;

          let timer = setInterval(async () => {
            let scrollHeightBefore = wrapper.scrollHeight;
            wrapper.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeightBefore) {
              // Reset totalHeight
              totalHeight = 0;

              // Wait for 3 seconds
              await new Promise((resolve) => setTimeout(resolve, scrollDelay));

              // Calculate scrollHeight after waiting
              let scrollHeightAfter = wrapper.scrollHeight;

              // If no more, stop scrolling
              if (scrollHeightAfter <= scrollHeightBefore) {
                clearInterval(timer);
                resolve();
              }
            }
          }, 200);
        });
      });
    }

    await autoScroll(page);

    const html = await page.content();

    // Take all <a> parent where <a> href includes /maps/place/
    const $ = cheerio.load(html);
    const aTags = $("a");
    const parents = [];
    aTags.each((i, el) => {
      const href = $(el).attr("href");
      if (href?.includes("/maps/place/")) parents.push($(el).parent());
    });

    const business = [];

    parents.forEach((parent) => {
      // https://www.google.com/maps/place/...
      const googleUrl = parent.find("a").attr("href");
      // Get <a> where data-value="Situs Web" (data-value can be "Website" or "Situs Web")
      const website = parent.find('a[data-value="Situs Web"]').attr("href");
      // Find <div> that has class fontHeadlineSmall
      const name = parent.find("div.fontHeadlineSmall").text();
      // find span that includes class fontBodyMedium
      const ratingText = parent.find("span.fontBodyMedium > span").attr("aria-label");

      // <div> includes the class fontBodyMedium
      const bodyDiv = parent.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const lastChild = children.last();
      const firstOfLast = lastChild.children().first();
      const lastOfLast = lastChild.children().last();

      business.push({
        name,
        website,
        category: firstOfLast?.text()?.split("·")?.[0]?.trim(),
        address: firstOfLast?.text()?.split("·")?.[1]?.trim(),
        phone: lastOfLast?.text()?.split("·")?.[1]?.trim(),
        googleUrl,
        ratingText,
      });
    });

    return { business, query }; // Return query along with the business data
  } catch (error) {
    console.log("Something went wrong!");
    throw error;
  } finally {
    await browser.close();
  }
}

// Function to create CSV file
function createCSV(data) {
  const { business, query } = data; // Extract business data and query
  const fileName = `${query.split(" ").join("_").toLowerCase()}.csv`; // Generate file name based on query
  let csvContent = "Name,Website,Category,Address,Phone,GoogleUrl,RatingText\n";

  business.forEach((businessItem) => {
    // Escape commas if present in data
    const name = businessItem.name.replace(/,/g, "");
    const website = businessItem.website ? businessItem.website.replace(/,/g, "") : "";
    const category = businessItem.category ? businessItem.category.replace(/,/g, "") : "";
    const address = businessItem.address ? businessItem.address.replace(/,/g, "") : "";
    const phone = businessItem.phone ? businessItem.phone.replace(/,/g, "") : "";
    const googleUrl = businessItem.googleUrl.replace(/,/g, "");
    const ratingText = businessItem.ratingText ? businessItem.ratingText.replace(/,/g, "") : "";

    // Append data to CSV content
    csvContent += `"${name}","${website}","${category}","${address}","${phone}","${googleUrl}","${ratingText}"\n`;
  });

  // Create folder if it doesn't exist
  const folderPath = path.join(process.cwd(), "result");
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  // Write CSV content to file
  const filePath = path.join(folderPath, fileName);
  fs.writeFileSync(filePath, csvContent, "utf8");

  console.log(`CSV file created successfully: ${filePath}`);
}

// Main function to retrieve data and create CSV
async function main(query) {
  try {
    // Get Google Maps data
    const data = await getGoogleMapsData(query);

    // Create CSV
    createCSV(data);

    console.log("Process completed successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function to prompt user input from terminal
function promptQuery() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Query: ", (query) => {
      rl.close();
      resolve(query);
    });
  });
}

// Function to prompt user to continue or stop
function promptContinue() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Use Again Process?\n1. Yes\n2. Stop\nYour Choice: ", (choice) => {
      rl.close();
      resolve(choice);
    });
  });
}

// Main loop to run the process and prompt user
async function mainLoop() {
  while (true) {
    const query = await promptQuery();
    await main(query);

    const choice = await promptContinue();
    if (choice !== "1") {
      console.log("Process stopped.");
      break;
    }
  }
}

// Call the main loop function
mainLoop();

