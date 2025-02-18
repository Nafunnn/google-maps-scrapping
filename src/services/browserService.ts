import { Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { IDetailInfo } from "../interfaces/gmaps";
import config from "../config";

/**
 * Function to automatically scroll on Google Maps pages.
 * @param page - Browser page (Puppeteer Page object).
 */
export const autoScroll = async (page: Page) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const containerData = document.querySelector('div[role="feed"]') as Element;
        let totalHeight = 0;
        const distance = 1000,
          scrollDelay = 3000;
        const timer = setInterval(() => {
          const scrollHeightBefore = containerData.scrollHeight;
          containerData.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeightBefore) {
            totalHeight = 0;
            setTimeout(() => {
              if (containerData.scrollHeight <= scrollHeightBefore) {
                clearInterval(timer);
                resolve();
              }
            }, scrollDelay);
          }
        }, 200);
      })
  );
};

/**
 * Retrieving data from Google Maps based on queries.
 * @param query - Search keywords.
 * @returns Objects contain data and query results.
 */
export const getData = async (query: string) => {
  puppeteerExtra.use(stealthPlugin());
  const browser = await puppeteerExtra.launch({ headless: config.headless });
  const page = await browser.newPage();

  try {
    await page.goto(`https://www.google.com/maps/search/${query}`);
    await autoScroll(page);

    const html = await page.content();
    const $all_data = cheerio.load(html);
    const results = $all_data("a")
      .map((_, link) => {
        const href = $all_data(link).attr("href");
        if (href && href.includes("/maps/place")) return $all_data(link).parent();
      })
      .get();

    const detailUrl = results.map((data) => {
      const detailUrl = data.find("a").attr("href");
      const category = data.find("div.fontBodyMedium").first().children().last().children().first().text().split("·")[0].trim();
      const ratingText = data.find("span.fontBodyMedium > span").attr("aria-label");
      
      return { detailUrl, category, ratingText };
    });

    const tampungHasil: IDetailInfo[] = [];
    for (const data of detailUrl) {
      if (!data.detailUrl) continue;

      const newTab = await browser.newPage();
      await newTab.goto(data.detailUrl);

      const htmlDetail = await newTab.content();
      const $detail_data = cheerio.load(htmlDetail);
      const detailInfo = $detail_data(`div[role="main"]`)
        .map((_, element) => {
          const name = $detail_data(element).find("h1").text();
          const dataRegion = $detail_data(element).find('div[role="region"]');
          const website = dataRegion.find('div > a[data-item-id="authority"]').attr("href");
          const address = dataRegion.find('button[data-item-id="address"] > div').children().last().children().first().text();
          const phone = dataRegion.find('button[data-item-id*="phone"] > div').children().last().children().first().text();
          return { name, website, category: data.category, address, phone, googleUrl: data.detailUrl, ratingText: data.ratingText };
        })
        .get()[0];

      if (config.autoclose) setTimeout(async () => await newTab.close(), config.autocloseTime);
      tampungHasil.push(detailInfo);
    }

    return { tampungHasil, query };
  } catch (error) {
    console.log(error);
  } finally {
    setTimeout(async () => await browser.close(), 5000);
  }
};
