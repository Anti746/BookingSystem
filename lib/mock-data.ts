// Static data for chatbot UI (mirrors database seed data)

export const courses = [
  { id: "1", name: "1 Day Course", type: "teaser", duration: "1.5h", price: 3000 },
  { id: "2", name: "3 Day Course", type: "plunge", duration: "Basic course - 3 classes (1.5h)", price: 8000 },
  { id: "3", name: "5 Day Course", type: "immerse", duration: "Main course - 5 classes (1.5h)", price: 12000 },
  { id: "4", name: "Kids", type: "kids", duration: "1.5h", price: 2000 },
  { id: "5", name: "Private Lesson", type: "private", duration: "1.5h", price: 5000 },
];

export const accommodationTypes = [
  { id: "1", name: "Standard Room", type: "standard", hasAC: false, pricePerNight: 25 },
  { id: "2", name: "Superior Room", type: "superior", hasAC: true, pricePerNight: 45 },
  { id: "3", name: "Premium Suite", type: "premium", hasAC: true, pricePerNight: 75 },
];
