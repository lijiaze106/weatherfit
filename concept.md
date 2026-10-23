Read 
Completed with input: {
  "path": "d:\\WeatherFit\\concept.md"
}

# WeatherFit: mobile-first web app plan

Based on `concept.md`, WeatherFit helps students and exercise beginners choose a sport and suitable gear for today’s weather. The MVP should center on **Your Plan** and use weather entered by the user—no weather API required.

## MVP user flow

1. Open **Your Plan**.
2. Optionally get current weather using the device location, or choose the condition (such as sunny or rainy) and temperature in °C manually.
3. Choose an exercise place and submit to see suitable sports and a gear checklist.
4. Adjust the weather and generate another plan.

## Pages

- **Home** — Brief introduction and a prominent “Make today’s plan” action.
- **Your Plan** — The main experience: weather form, results, and gear list.
- **Sports Guide** — Browse sports with short descriptions and general suitability notes.
- **About** — Explain the app’s purpose and that recommendations are general guidance.

On phones, use a compact header and a **bottom navigation bar** for the four sections. On larger screens, expand the content width and consider a top navigation bar.

## Your Plan screen

Design the primary flow for a narrow screen first:

1. **Weather form**
   - Exercise place
   - Current-weather button (optional; requires location permission and an internet connection)
   - Weather condition selector for manual entry or adjustment
   - Temperature slider from -50 to 60 °C with the current value displayed
   - “Get my plan” button
2. **Recommendations**
   - One or more suggested sports, each with a short reason tied to the entered conditions
   - A gear checklist for the selected conditions
3. **Empty and error states**
   - Before submission, explain what information to enter
   - Validate missing place and missing condition; keep the temperature within the slider’s supported range
   - Keep the submitted weather visible so users can review or edit it

Use clear labels rather than relying on placeholders, and make inputs and buttons comfortable to tap.

## Recommendation behavior

Keep the first version understandable and predictable. Start with a small set of rule-based recommendations for common conditions—such as sunny, rainy, and cold—and match each to a short list of sports and gear. Make it clear that suggestions are general, and encourage users to use their judgment about local conditions and their own abilities.

## Implementation sequence

1. Define the weather form fields and recommendation rules.
2. Build the shared mobile layout and four-page navigation.
3. Implement and validate the Your Plan input flow.
4. Add recommendations and the gear checklist.
5. Fill out Home, Sports Guide, and About.
6. Check responsive layouts, keyboard access, readable contrast, and form validation on small screens.

## MVP acceptance criteria

- A user can manually enter an exercise place, condition, and temperature and receive a plan without an account.
- A user can optionally load current weather and an approximate city from their location; denial or network failure leaves manual entry available.
- Results include at least one suggested sport and a relevant gear list.
- Invalid or incomplete input receives clear feedback.
- All four pages are reachable on mobile and desktop.
- The app works without a live weather service.

**Out of scope for the MVP:** weather forecasts, accounts, saved plans, social features, and advanced personalization.



WeatherFit/
├── index.html
├── plan.html
├── sports.html
├── about.html
├── css/
│   └── styles.css
├── js/
│   └── plan.js
└── images/
    └── og-image.jpg   (之后再做)