export type GoldTableContract = {
  name: string;
  grain: string;
  purpose: string;
  consumers: string[];
  status: "planned" | "available";
};

export const goldTableCatalog: GoldTableContract[] = [
  {
    name: "gold.sales_daily",
    grain: "day × store × product",
    purpose: "Business sales and margin analysis",
    consumers: ["Power BI", "SQL"],
    status: "planned",
  },
  {
    name: "gold.customer_360",
    grain: "customer",
    purpose: "Conformed customer profile and behavioral aggregates",
    consumers: ["Power BI", "SQL", "ML features"],
    status: "planned",
  },
  {
    name: "gold.delivery_performance",
    grain: "shipment",
    purpose: "Delivery reliability, delays and service-level analysis",
    consumers: ["Power BI", "SQL", "ML features"],
    status: "planned",
  },
  {
    name: "gold.customer_satisfaction",
    grain: "customer × period",
    purpose: "Reviews, support outcomes, returns and satisfaction KPIs",
    consumers: ["Power BI", "SQL", "ML features"],
    status: "planned",
  },
  {
    name: "gold.customer_scores",
    grain: "customer × model version × scoring time",
    purpose: "Historical model scores returned from the ML stage",
    consumers: ["Power BI", "SQL"],
    status: "planned",
  },
];
