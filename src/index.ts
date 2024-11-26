import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import readline from "readline";
import { Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

import { IDetailInfo, IQuery } from "./utility/Types";
import config from "./config";

// Create a prompt for the user to enter the query
const promptUser = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question("Enter the query: ", (answer) => {
      resolve(answer);
      rl.close();
    });
  });
};

// Get data from the Google Maps page
const getData = async (query: string) => {
  puppeteerExtra.use(stealthPlugin());
  const browser = await puppeteerExtra.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(`https://www.google.com/maps/search/${query}`);

    // Auto scroll to load all the data on container
    const autoScroll = async (page: Page) => {
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          // Get the container of the data [target div]
          const containerData = document.querySelector('div[role="feed"]') as Element;
          let totalHeight = 0;
          const distance = 1000;
          const scrollDelay = 3000;

          const timer = setInterval(() => {
            const scrollHeightBefore = containerData.scrollHeight;
            containerData.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeightBefore) {
              totalHeight = 0;
              setTimeout(() => {
                const scrollHeightAfter = containerData.scrollHeight;
                if (scrollHeightAfter <= scrollHeightBefore) {
                  clearInterval(timer);
                  resolve();
                }
              }, scrollDelay);
            }
          }, 200);
        });
      });
    };

    // Wait for the page to load fully
    await autoScroll(page);

    // Get the HTML content of the page
    const html = await page.content();
    // Load the HTML content into cheerio and take all tag a href include /maps/place
    const $all_data = cheerio.load(html);
    const links = $all_data("a");
    const results = links.map((_, link) => {
      const href = $all_data(link).attr("href");
      if (href && href.includes("/maps/place")) return $all_data(link).parent();
    });

    const detailUrl = results.map((index, data) => {
      // find the url detail https://www.google.com/maps/place/... and return it
      const detailUrl = data.find("a").attr("href");
      // find the category of the business and return it
      // <div> includes the class fontBodyMedium
      const bodyDiv = data.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const firstOfLast = children.last().children().first();
      const category = firstOfLast.text().split("·")[0].trim();
      // find span that includes class fontBodyMedium
      const ratingText = data.find("span.fontBodyMedium > span").attr("aria-label");

      return { detailUrl, category, ratingText };
    });

    const tampungHasil: IDetailInfo[] = [];
    // Loop through all the detail url
    let ea = 0;
    for (const data of detailUrl) {
      ea++;
      if (!data.detailUrl) continue;
      // Open all the detail url in new tab
      const newTab = await browser.newPage();
      await newTab.goto(data.detailUrl);

      // Get the HTML content of the page
      const htmlDetail = await newTab.content();
      // Load the HTML content into cheerio
      const $detail_data = cheerio.load(htmlDetail);
      const detailInfo = $detail_data(`div[role="main"]`).map((_, element) => {
        const name = $detail_data(element).find("h1").text();
        const dataRegion = $detail_data(element).find('div[role="region"]');
        const website = dataRegion.find('div > a[data-item-id="authority"]').attr("href");
        const address = dataRegion.find('button[data-item-id="address"] > div').children().last().children().first().text();
        const phone = dataRegion.find('button[data-item-id*="phone"] > div').children().last().children().first().text();

        return {
          name,
          website,
          category: data.category,
          address,
          phone,
          googleUrl: data.detailUrl,
          ratingText: data.ratingText,
        };
      });
      if (config.autoclose) {
        setTimeout(async () => {
          await newTab.close();
        }, config.autocloseTime);
      }
      tampungHasil.push(detailInfo.get()[0]);
    }

    return { tampungHasil, query };
  } catch (error) {
    console.log(error);
  } finally {
    setTimeout(async () => {
      await browser.close();
    }, 5000);
  }
};

// Create CSV file
const createFileCSV = (data: IQuery | undefined) => {
  if (!data) return;
  const { tampungHasil, query } = data; // Extract detailInfo data and query
  const fileName = `${query.split(" ").join("_").toLowerCase()}.csv`; // Generate file name based on query
  let csvContent = "Name,Website,Category,Address,Phone,GoogleUrl,RatingText\n";

  tampungHasil.forEach((detailInfoItem) => {
    // Escape commas if present in data
    const name = detailInfoItem.name ? detailInfoItem.name.replace(/,/g, "") : "";
    const website = detailInfoItem.website ? detailInfoItem.website.replace(/,/g, "") : "";
    const category = detailInfoItem.category ? detailInfoItem.category.replace(/,/g, "") : "";
    const address = detailInfoItem.address ? detailInfoItem.address.replace(/,/g, "") : "";
    const phone = detailInfoItem.phone ? detailInfoItem.phone.replace(/,/g, "") : "";
    const googleUrl = detailInfoItem.googleUrl ? detailInfoItem.googleUrl.replace(/,/g, "") : "";
    const ratingText = detailInfoItem.ratingText ? detailInfoItem.ratingText.replace(/,/g, "") : "";

    console.log({ name, website, category, address, phone, googleUrl, ratingText });

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
};

// prompt user to continue or stop
const promptContinue = () => {
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
};

const main = async () => {
  while (true) {
    const query = await promptUser();
    const data = await getData(query);
    createFileCSV(data);
    console.log("Process completed successfully.");

    const choice = await promptContinue();
    if (choice !== "1") break;
  }
};

main();
