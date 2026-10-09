// The four programs, per Dr. Antonious (CLAUDE.md): Medical care, Dietitian
// services, Comprehensive Exercise Plan, Follow-ups. Each entry here gets its
// own landing page at /programs/:slug (ProgramPage.jsx). Programs without an
// entry yet are listed in PROGRAM_NAMES so every page can still show all four.
//
// DRAFT COPY: written from what the site and the client meeting already say.
// Dr. Antonious must review every page before launch. It deliberately has no
// statistics, outcome claims, or medication names. On Medical care, medication
// is always one part of the program, prescribed only when a licensed provider
// finds it clinically appropriate (CLAUDE.md compliance boundary).

export const PROGRAM_NAMES = ["Medical care", "Dietitian services", "Comprehensive Exercise Plan", "Follow-ups"]

export const programs = [
  {
    slug: "medical-care",
    name: "Medical care",
    title: "Medical Care | CorePhia Weight Loss Program in Tampa",
    description:
      "Physician-guided medical care as part of CorePhia's weight loss program in Tampa: a licensed provider, a review of your full health history, and medication only if your provider prescribes it.",
    headline: "Medical care from a provider who knows your whole plan.",
    intro:
      "Your provider reviews your health history, follows your progress, and decides with you whether weight loss medication belongs in your plan. If it does, it becomes one part of your program, alongside your nutrition and exercise plans.",
    whatWeDo: [
      "Before anything else, your provider reads your intake: your goal, your health history, the medications you take, and what you've tried before. That shapes your whole plan, including your nutrition and exercise.",
      "Your history stays with your care, so whoever reviews your progress starts from everything you've already shared.",
    ],
    whatYouGet: [
      "A provider review of your intake and health history",
      "Medical care planned alongside your nutrition and exercise",
      "Medication only if your provider prescribes it",
      "Provider check-ins as your plan progresses",
    ],
    steps: [
      { title: "Get started", body: "One question at a time, in about ten minutes." },
      { title: "Your provider reviews it", body: "They look at your history and goals, and follow up with any questions." },
      { title: "Start your plan", body: "Your medical care is set up with your meal and exercise plans, and adjusted at each follow-up." },
    ],
    faqs: [
      {
        q: "Will I get weight loss medication?",
        a: "Not automatically. A licensed provider decides whether medication is appropriate after reviewing your health history, and you can follow the program without it. Membership does not include or guarantee a prescription.",
      },
      {
        q: "Who is my provider?",
        a: "A licensed provider who is board certified in internal medicine. Your provider reviews your intake and follows your progress from there.",
      },
      {
        q: "Do you take insurance?",
        a: "No. CorePhia is cash pay, so there are no insurance approvals standing between you and your care.",
      },
      {
        q: "Does this replace my regular doctor?",
        a: "No. CorePhia focuses on your weight loss program. Keep seeing your regular doctor for your other care, and tell your provider about any change in your health or medications.",
      },
    ],
  },
  {
    slug: "dietitian-services",
    name: "Dietitian services",
    title: "Dietitian Services | CorePhia Weight Loss Program in Tampa",
    description:
      "Dietitian services as part of CorePhia's weight loss program in Tampa: a meal plan built around how you already eat, adjusted as you progress and coordinated with your provider.",
    headline: "A meal plan built around how you actually eat.",
    intro:
      "A dietitian looks at what a normal day of eating is like for you, then builds a plan around it that you can keep up for the long run.",
    whatWeDo: [
      "Your dietitian starts from your intake: how many meals you eat, your habits, your restrictions, and your goal. The plan fits your life instead of asking you to start over.",
      "As your weight and routine change, your plan changes with you. Your dietitian and your provider share your progress, so your meal plan and your medical care stay in step.",
    ],
    whatYouGet: [
      "A personal meal plan built from your intake",
      "Guidance on portions, protein, and everyday food choices",
      "Adjustments as your progress and routine change",
      "A plan coordinated with your provider and your exercise plan",
    ],
    steps: [
      { title: "Get started", body: "One question at a time, in about ten minutes." },
      { title: "Your dietitian reviews how you eat", body: "Your answers about meals and habits become the starting point." },
      { title: "Get your meal plan", body: "Built around foods you already like, and updated at each follow-up." },
    ],
    faqs: [
      {
        q: "Do I have to follow a strict diet?",
        a: "No. Your plan is built around how you already eat and changes step by step, so it's something you can keep doing.",
      },
      {
        q: "Can the plan work with my dietary restrictions?",
        a: "Yes. Tell us about allergies, restrictions, or foods you avoid in your intake, and your plan is built around them.",
      },
      {
        q: "Is this the same as nutrition coaching?",
        a: "Yes. Dietitian services and nutrition coaching are the same part of the CorePhia program.",
      },
      {
        q: "Do I need to count calories?",
        a: "Not unless it helps you. Your dietitian suggests the kind of tracking, if any, that fits your goal and your routine.",
      },
    ],
  },
  {
    slug: "exercise-plan",
    name: "Comprehensive Exercise Plan",
    title: "Comprehensive Exercise Plan | CorePhia Weight Loss Program in Tampa",
    description:
      "A comprehensive exercise plan as part of CorePhia's weight loss program in Tampa: written for your fitness level and schedule, and adjusted as you get stronger.",
    headline: "An exercise plan written for your body, starting where you are.",
    intro:
      "You get a written exercise plan matched to your fitness level and your schedule, and it grows as you get stronger.",
    whatWeDo: [
      "Your plan starts from what you told us in your intake: how often you move now, your health history, and any limits. No one expects you to start at a gym five days a week.",
      "At each follow-up the plan is reviewed and adjusted to keep pace with your progress and fit your health.",
    ],
    whatYouGet: [
      "A written exercise plan matched to your fitness level",
      "Workouts that fit your schedule, at home or at a gym",
      "Steady progression as you get stronger",
      "A plan coordinated with your nutrition and medical care",
    ],
    steps: [
      { title: "Get started", body: "One question at a time, in about ten minutes." },
      { title: "We review your activity and health", body: "Your current routine and any limits shape where you start." },
      { title: "Start your plan", body: "Clear workouts you can follow, adjusted at each follow-up." },
    ],
    faqs: [
      {
        q: "I don't exercise at all right now. Is that okay?",
        a: "Yes. Your plan starts from where you are today, even if that's no exercise at all, and builds from there.",
      },
      {
        q: "Do I need a gym membership?",
        a: "No. Your plan can be built around what you have access to, including exercising at home.",
      },
      {
        q: "Is this physical therapy?",
        a: "No. It's an exercise plan for weight loss and fitness. If you need physical therapy for an injury, talk to your provider.",
      },
      {
        q: "What if I have an injury or a health condition?",
        a: "Tell us in your intake. Your plan takes your health history into account, and your provider reviews it.",
      },
    ],
  },
  {
    slug: "follow-ups",
    name: "Follow-ups",
    title: "Follow-ups | CorePhia Weight Loss Program in Tampa",
    description:
      "Follow-ups as part of CorePhia's weight loss program in Tampa: regular check-ins with your provider, where your nutrition, exercise, and medical care are reviewed and adjusted together.",
    headline: "Regular check-ins that keep your plan on track.",
    intro:
      "Follow-ups are where your plan gets reviewed and adjusted, so it keeps working as your body and your routine change.",
    whatWeDo: [
      "At each follow-up you review your progress with your care team: your weight, how you're feeling, and how the plan fits your life.",
      "Anything that isn't working gets changed, whether that's your meals, your workouts, or your medical care. Each check-in picks up from your full history.",
    ],
    whatYouGet: [
      "Scheduled check-ins to review your progress",
      "Changes to your meal, exercise, and medical plans as needed",
      "Progress tracked over time",
      "Your full history at every visit",
    ],
    steps: [
      { title: "Get started", body: "One question at a time, in about ten minutes." },
      { title: "Start your plan", body: "Your provider, dietitian, and exercise plan are set up for you." },
      { title: "Check in regularly", body: "Each follow-up reviews your progress and updates your plan." },
    ],
    faqs: [
      {
        q: "How often are follow-ups?",
        a: "Your provider sets a schedule that fits your plan. How often you check in depends on your membership, which is listed on the membership page.",
      },
      {
        q: "What happens at a follow-up?",
        a: "You review your progress, talk through what's working and what isn't, and your plan is adjusted to match.",
      },
      {
        q: "Will my provider know my history?",
        a: "Yes. Your intake and every follow-up stay in your record, so each visit starts from where the last one ended.",
      },
      {
        q: "What if my plan isn't working?",
        a: "That's what follow-ups are for. Your care team looks at what isn't working and changes the plan.",
      },
    ],
  },
]
