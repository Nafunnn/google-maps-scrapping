import fs from "fs";
import path from "path";
import { IQuery } from "../interfaces/gmaps";
import config from "../config";

/**
 * Create a CSV file from the collected data.
 * @param data - Objects contain data and query results.
 * @param exentesionFile - File extension to be created.
 */
export const createFile = (data: IQuery | undefined, exentesionFile: "csv" | "json") => {
  if (!data) return;

  const { tampungHasil, query } = data;
  const fileName = `${query.split(" ").join("_").toLowerCase()}.${exentesionFile}`;
  const folderPath = path.join(process.cwd(), "result");
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

  if (tampungHasil.filter((item) => item !== undefined).length !== tampungHasil.length) {
    console.log(`[Failed] ${fileName} not created, no data found. skipping...`);
  } else {
    if (exentesionFile === "csv") {
      let csvContent = "Name,Website,Category,Address,Phone,GoogleUrl,RatingText\n";

      tampungHasil.forEach(({ name, website, category, address, phone, googleUrl, ratingText }) => {
        if (config.showLogResult) console.log({ name, website, category, address, phone, googleUrl, ratingText });
        csvContent += `"${name?.replace(/,/g, "")}","${website?.replace(/,/g, "")}","${category?.replace(/,/g, "")}","${address?.replace(
          /,/g,
          ""
        )}","${phone?.replace(/,/g, "")}","${googleUrl?.replace(/,/g, "")}","${ratingText?.replace(/,/g, "")}"\n`;
      });

      fs.writeFileSync(path.join(folderPath, fileName), csvContent, "utf8");
    } else {
      const jsonContent = tampungHasil.map(({ name, website, category, address, phone, googleUrl, ratingText }) => ({
        name,
        website,
        category,
        address,
        phone,
        googleUrl,
        ratingText,
      }));

      fs.writeFileSync(path.join(folderPath, fileName), JSON.stringify(jsonContent, null, 2), "utf8");
    }

    console.log(`[Successfuly] ${exentesionFile.toUpperCase()} file created successfully: ${path.join(folderPath, fileName)}`);
  }
};
