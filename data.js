// Shared data: every sport the site knows about.
// Used by plan.js (recommendations) and sports.js (Sports Guide page).

const ALL_WEATHER = ["sunny", "cloudy", "rainy", "snowy", "windy"];

// Place keys (the option values in plan.html) and their display names
const PLACES = {
  park: "Park",
  campus: "Campus field",
  street: "Street",
  mountain: "Mountain",
  lake: "Beach / Lakeside",
  indoor: "Indoor"
};

// place: "indoor" or "outdoor"   spots: the places where the sport suits
const SPORTS = [
  {
    name: "Running",
    place: "outdoor",
    spots: ["park", "campus", "street", "lake"],
    weather: ["sunny", "cloudy", "windy"],
    minTemp: 0, maxTemp: 30,
    gear: ["Running shoes", "Water bottle"],
    about: "A simple way to start: all you need is a pair of shoes and a route.",
    note: "Start slowly and walk if you feel dizzy."
  },
  {
    name: "Cycling",
    place: "outdoor",
    spots: ["park", "street", "lake"],
    weather: ["sunny", "cloudy"],
    minTemp: 8, maxTemp: 32,
    gear: ["Helmet", "Water bottle"],
    about: "Cover more ground than running with less stress on your knees.",
    note: "Always wear a helmet and keep to bike lanes."
  },
  {
    name: "Tennis",
    place: "outdoor",
    spots: ["campus", "park"],
    weather: ["sunny", "cloudy"],
    minTemp: 10, maxTemp: 32,
    gear: ["Racket", "Water bottle"],
    about: "A fun game for two or four that trains reaction and footwork.",
    note: "Wind and wet courts make the ball and the ground unpredictable."
  },
  {
    name: "Basketball",
    place: "outdoor",
    spots: ["campus", "park"],
    weather: ["sunny", "cloudy"],
    minTemp: 8, maxTemp: 30,
    gear: ["Basketball", "Court shoes"],
    about: "Team sport that is easy to join for a casual game.",
    note: "Warm up your ankles before playing."
  },
  {
    name: "Hiking",
    place: "outdoor",
    spots: ["mountain", "park", "lake"],
    weather: ["sunny", "cloudy", "windy"],
    minTemp: 5, maxTemp: 28,
    gear: ["Hiking shoes", "Water bottle", "Snack"],
    about: "A slow, steady way to enjoy nature and build leg strength.",
    note: "Tell someone your route and be back before dark."
  },
  {
    name: "Winter walking",
    place: "outdoor",
    spots: ["park", "campus", "street", "lake"],
    weather: ["snowy", "cloudy"],
    minTemp: -10, maxTemp: 6,
    gear: ["Non-slip shoes", "Warm hat"],
    about: "A gentle walk in cold air that keeps you moving in winter.",
    note: "Watch out for ice and take shorter steps."
  },
  {
    name: "Skiing",
    place: "outdoor",
    spots: ["mountain"],
    weather: ["snowy"],
    minTemp: -15, maxTemp: 2,
    gear: ["Ski goggles", "Warm layers"],
    about: "A snow sport for days when everything outside is white.",
    note: "Take a lesson first if you are a beginner."
  },
  {
    name: "Swimming (indoor pool)",
    place: "indoor",
    spots: ["indoor"],
    weather: ALL_WEATHER,
    minTemp: -50, maxTemp: 60,
    gear: ["Swimsuit", "Goggles", "Towel"],
    about: "Full-body exercise that is easy on the joints.",
    note: "Do not swim alone if you are not confident."
  },
  {
    name: "Gym workout",
    place: "indoor",
    spots: ["indoor"],
    weather: ALL_WEATHER,
    minTemp: -50, maxTemp: 60,
    gear: ["Gym shoes", "Towel"],
    about: "Strength and cardio machines, whatever the weather.",
    note: "Ask staff to show you how a machine works before you use it."
  },
  {
    name: "Yoga",
    place: "indoor",
    spots: ["indoor"],
    weather: ALL_WEATHER,
    minTemp: -50, maxTemp: 60,
    gear: ["Yoga mat"],
    about: "Stretching and breathing you can do at home with no equipment.",
    note: "Never push into pain."
  },
  {
    name: "Table tennis",
    place: "indoor",
    spots: ["indoor"],
    weather: ALL_WEATHER,
    minTemp: -50, maxTemp: 60,
    gear: ["Paddle"],
    about: "A quick, friendly game that needs only a table and a bat.",
    note: "Keep the floor around the table clear."
  },
  {
    name: "Badminton (indoor)",
    place: "indoor",
    spots: ["indoor"],
    weather: ALL_WEATHER,
    minTemp: -50, maxTemp: 60,
    gear: ["Racket", "Shuttlecocks"],
    about: "Fast and social, and the wind cannot blow the shuttle away indoors.",
    note: "Warm up your shoulders first."
  }
];

// Extra gear that depends only on the weather
const WEATHER_GEAR = {
  sunny:  ["Sunscreen", "Cap or hat"],
  cloudy: ["Light jacket"],
  rainy:  ["Rain jacket", "Waterproof shoes", "Dry clothes"],
  snowy:  ["Waterproof boots", "Gloves"],
  windy:  ["Windbreaker", "Sports glasses"]
};