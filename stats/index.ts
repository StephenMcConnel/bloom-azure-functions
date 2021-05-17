import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { processEvents } from "./events";
import { AxiosRequestConfig } from "axios";

export interface IFilter {
  parseDBQuery?: { url: string; options: AxiosRequestConfig };
  branding?: string;
  country?: string;
  fromDate?: string;
  toDate?: string;
}

const stats: AzureFunction = async function(
  context: Context,
  req: HttpRequest
): Promise<void> {
  try {
    const t0 = new Date().getTime();

    const category = req.params.category;
    const rowType = req.params.rowType;

    const filter = req.query.filter || (req.body && req.body.filter);

    if (category && rowType && filter) {
      await processEvents(context, category, rowType, filter);
      return;
    } else {
      // This whole else should be rewritten for the new category/rowType url model.
      // For now, leaving it for backward compatibility since the book detail stats are actively using it
      // (albeit on the contentful branch, Jul 6 2020).

      const book = req.query.book || (req.body && req.body.book);
      const bookInstanceId =
        req.query["book-instance-id"] ||
        (req.body && req.body["book-instance-id"]);

      if (book && bookInstanceId) {
        const { Client } = require("pg");
        const client = new Client();
        await client.connect();

        const queryResult = await client.query(
          "SELECT * FROM common.get_book_stats($1, $2)", //, $3, $4)",
          [book, bookInstanceId] //, from, to]
        );
        context.res = {
          headers: { "Content-Type": "application/json" },
          body: { bookstats: queryResult.rows[0] },
        };
        context.done();

        await client.end();
      } else {
        fail(
          context,
          "Url, request body, or params are not in a valid state. Provide filter or book."
        );
      }
    }

    const t1 = new Date().getTime();
    context.log(
      "stats function took " + (t1 - t0) + " milliseconds to complete."
    );
  } catch (e) {
    fail(context, e.message);
  }
};

function fail(context: Context, message: string): void {
  context.res = {
    status: 400,
    body: message,
  };
}

export default stats;
