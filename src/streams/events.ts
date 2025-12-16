import type { PerpOpportunity } from "../core/types.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";

export type AppEvents = {
  "opps:update": {
    top: PerpOpportunity[];
    updatedAt: number;
  };

  "market:top": TopOfBook;
};
