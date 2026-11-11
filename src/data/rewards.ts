export type RewardCategory = "Challenges" | "Tools" | "Gift cards" | "Experiences";

export type RewardItem = {
  id: string;
  name: string;
  category: RewardCategory;
  cost: number;
  value: string;
  description: string;
  badge?: string;
};

export const rewardCategories: ("All" | RewardCategory)[] = ["All", "Challenges", "Tools", "Gift cards", "Experiences"];

export const rewardCatalog: RewardItem[] = [
  { id: "challenge-10", name: "$10 Challenge Credit", category: "Challenges", cost: 1000, value: "$10", description: "Credit toward an eligible prop-firm challenge fee, applied as a voucher or account credit." },
  { id: "challenge-25", name: "$25 Challenge Credit", category: "Challenges", cost: 2400, value: "$25", description: "A larger challenge credit with a small credit bonus built into the price.", badge: "Best value" },
  { id: "challenge-50", name: "$50 Challenge Credit", category: "Challenges", cost: 4500, value: "$50", description: "Put a meaningful amount back toward your next evaluation account." },
  { id: "challenge-100", name: "$100 Challenge Credit", category: "Challenges", cost: 8500, value: "$100", description: "Our highest challenge credit tier for active traders who buy regularly." },
  { id: "charting-month", name: "Charting Platform Credit", category: "Tools", cost: 1500, value: "$15", description: "Credit toward a charting or analytics subscription of your choice." },
  { id: "journal-year", name: "Trading Journal Credit", category: "Tools", cost: 3000, value: "$30", description: "Credit toward a trade-journaling or performance analytics tool.", badge: "Popular" },
  { id: "vps-quarter", name: "Trading VPS Credit", category: "Tools", cost: 3600, value: "$36", description: "Credit toward a virtual server for running platforms and automated strategies." },
  { id: "gift-10", name: "$10 Digital Gift Card", category: "Gift cards", cost: 1100, value: "$10", description: "A digital gift card from a major retailer, delivered by email after fulfilment." },
  { id: "gift-25", name: "$25 Digital Gift Card", category: "Gift cards", cost: 2700, value: "$25", description: "A mid-size digital gift card for everyday spending." },
  { id: "gift-50", name: "$50 Digital Gift Card", category: "Gift cards", cost: 5300, value: "$50", description: "A larger digital gift card for travel, tech or shopping." },
  { id: "coaching-30", name: "30-Minute Strategy Review", category: "Experiences", cost: 6000, value: "1 session", description: "A one-to-one review of your risk plan, journal and challenge approach.", badge: "Limited" },
  { id: "workshop-seat", name: "Live Workshop Seat", category: "Experiences", cost: 2000, value: "1 seat", description: "Reserve a seat in an upcoming APEX trader workshop on challenge rules and risk." },
];
