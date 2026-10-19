// Plain-language guides, one page each at /guides/:slug (GuidePage.jsx), linked
// from the matching program page. Same rules as programs.js: no statistics or
// outcome claims without a source, no medication names, and medication only
// ever as one part of the program, prescribed when clinically appropriate.
// DRAFT COPY: the provider must read these before launch (the page says
// "Medically reviewed", see components/ReviewedLine.jsx). A guide written after
// the last review carries `reviewed: false`, which hides that line and the
// lastReviewed date until the provider has read it; then remove the flag and
// move LAST_REVIEWED.
//
// A string in `body` is a paragraph, an array is a bullet list.
export const guides = [
  {
    slug: "how-medical-weight-loss-works",
    program: "medical-care",
    name: "How medical weight loss works",
    title: "How Medical Weight Loss Works | CorePhia, Tampa",
    description:
      "How a physician-guided weight loss program works, from intake to follow-ups, and how a provider decides if medication belongs in it.",
    intro:
      "Medical weight loss means a licensed provider is part of your plan from the start. Instead of a diet you try on your own, your provider looks at your health as a whole and builds a plan with you, then keeps adjusting it as you go.",
    sections: [
      {
        h: "How does medical weight loss start?",
        body: [
          "Weight is tied to many things: sleep, stress, medications you already take, conditions like thyroid problems or diabetes, and what you have tried before. A provider looks at all of it before recommending anything. That is the main difference from a diet plan, which treats everyone the same.",
          "At CorePhia this first step is the intake. It takes about ten minutes and asks about your goals, your medical and family history, your medications and allergies, and what a normal day of eating and movement looks like for you.",
        ],
      },
      {
        h: "What is in a medical weight loss plan?",
        body: [
          "After reviewing your intake, your provider meets with you, asks any follow-up questions, and sets up a plan. A medical weight loss plan usually has several parts that work together:",
          [
            "A meal plan, built by a dietitian around how you already eat.",
            "An exercise plan, matched to your fitness level and your schedule.",
            "Medical care: your provider watches how your health responds and adjusts the plan.",
            "Medication, but only if your provider decides it is clinically appropriate for you.",
          ],
        ],
      },
      {
        h: "Will I need weight loss medication?",
        body: [
          "Prescription weight loss medication can help some people, and it is not right for everyone. Whether it belongs in your plan is a medical decision your provider makes after looking at your history, your other medications, and your goals. Many patients follow the program without it.",
          "When it is prescribed, it is one part of the plan, never the whole plan. Food, movement, and regular follow-ups still do most of the work, and they are what helps results last.",
        ],
      },
      {
        h: "Why do follow-ups matter?",
        body: [
          "Bodies and routines change, so a plan that works in the first month may need to change by the third. At each follow-up you and your care team look at your progress and how the plan fits your life, then change what is not working. You can also log your weight and send messages in your patient portal between visits.",
        ],
      },
      {
        h: "Is medical weight loss right for you?",
        body: [
          "Medical weight loss can make sense if you have tried to lose weight on your own without lasting results, if your weight affects your health, or if you want a provider to guide the process. Only a provider can tell you what is appropriate for you, which is why every CorePhia plan starts with a review of your health. CorePhia currently cares for adults located in Florida.",
        ],
      },
    ],
  },
  {
    slug: "what-a-dietitian-does",
    program: "dietitian-services",
    name: "What a dietitian does in a weight loss program",
    title: "What a Dietitian Does in a Weight Loss Program | CorePhia",
    description:
      "What a registered dietitian does in a weight loss program: how they look at how you eat and build a meal plan you can keep.",
    intro:
      "A registered dietitian is a nutrition professional with formal training and a credential to match. In a weight loss program, their job is to help you change how you eat in a way you can keep up, without starting from a template that ignores your life.",
    sections: [
      {
        h: "What is a registered dietitian?",
        body: [
          "Registered Dietitians (sometimes written RDN, for Registered Dietitian Nutritionist) complete a degree in nutrition, supervised practice, and a national exam, and they keep up continuing education. Anyone can call themselves a nutrition coach. A registered dietitian has to meet these standards.",
        ],
      },
      {
        h: "Where does a dietitian start?",
        body: [
          "Your dietitian begins with what a normal day looks like for you: how many meals you eat, what you snack on, what you drink, what you cook, and what you avoid. At CorePhia these answers come from your intake, so the first plan is built on your real habits.",
          "From there, the changes are made step by step. A plan that asks you to give up everything at once rarely lasts. One built around foods you already like has a much better chance.",
        ],
      },
      {
        h: "What does a meal plan cover?",
        body: [
          [
            "Portions and balance across your meals.",
            "Enough protein, fiber, and fluids to stay full and keep your energy up.",
            "Practical choices for busy days, eating out, and the foods you love.",
            "Allergies, restrictions, and cultural or personal food preferences.",
            "Tracking, but only the kind that helps you. Not everyone needs to count calories.",
          ],
        ],
      },
      {
        h: "Does the meal plan change over time?",
        body: [
          "As your weight, routine, and goals change, your meal plan changes with them. At CorePhia your dietitian and your provider share your progress, so your nutrition stays in step with your medical care and your exercise plan. If you are prescribed medication that affects your appetite, your meal plan is adjusted for that too.",
        ],
      },
      {
        h: "Can a dietitian prescribe medication?",
        body: [
          "A dietitian does not prescribe medication or diagnose medical conditions. Those are your provider's job. The two work together, which is why CorePhia puts dietitian services, an exercise plan, medical care, and follow-ups in one program.",
        ],
      },
    ],
  },
  {
    slug: "exercise-for-weight-loss",
    program: "exercise-plan",
    name: "Exercise for weight loss",
    title: "Exercise for Weight Loss: How a Plan Is Built | CorePhia",
    description:
      "How an exercise plan for weight loss is built: starting from your fitness level, mixing cardio and strength, and progressing safely.",
    intro:
      "Exercise on its own is rarely the fastest way to lose weight, but it is one of the best ways to keep weight off, protect muscle, and feel better while you do it. A good plan starts where you are, not where a fitness app thinks you should be.",
    sections: [
      {
        h: "Why does exercise matter for weight loss?",
        body: [
          "Exercise helps you keep muscle while you lose fat, improves heart health, blood sugar, sleep, and mood, and makes it more likely the weight stays off. Food choices usually drive most of the weight you lose, so exercise does a different job. That is why CorePhia treats exercise as its own part of the program, alongside dietitian services and medical care.",
        ],
      },
      {
        h: "How much exercise do you need?",
        body: [
          "The U.S. Physical Activity Guidelines for Americans recommend that adults get at least 150 minutes a week of moderate activity, such as brisk walking, plus muscle-strengthening activity on at least two days a week. Those are targets to build toward, not where you have to begin. Any movement counts, and starting small is fine.",
        ],
      },
      {
        h: "How is an exercise plan built?",
        body: [
          [
            "It starts from your intake: how often you move now, your health history, and any injuries or limits.",
            "It mixes aerobic activity, like walking or cycling, with strength work you can do at home or at a gym.",
            "It fits your schedule. A plan you can actually follow beats a perfect plan you skip.",
            "It is written down, so you know exactly what to do each week.",
          ],
        ],
      },
      {
        h: "How does the plan progress safely?",
        body: [
          "As you get stronger, your plan asks a little more of you, by adding time, weight, or a new kind of workout. At each follow-up it is reviewed and adjusted. If something hurts, or a health condition limits what you can do, tell your provider so the plan can change. An exercise plan is not physical therapy. If you need treatment for an injury, your provider can point you to the right care.",
        ],
      },
      {
        h: "What if you do not exercise at all?",
        body: [
          "If you do not exercise at all right now, you are exactly who a plan like this is for. The first weeks are about building a habit, not about intensity. A short daily walk is a real start.",
        ],
      },
    ],
  },
  {
    slug: "choosing-a-weight-loss-program-in-florida",
    reviewed: false,
    program: "medical-care",
    name: "How to choose a weight loss program in Florida",
    title: "How to Choose a Weight Loss Program in Florida | CorePhia",
    description:
      "Questions to ask before you join a weight loss program in Florida: who is on the care team, how medication is decided, and what follow-up looks like.",
    intro:
      "Weight loss programs in Florida range from a diet app to a full medical practice, and the names do not tell you which is which. Before you sign up for one, a few plain questions will show you what you would actually get.",
    sections: [
      {
        h: "Who is on the care team?",
        body: [
          "Ask who will look after you and what their credentials are. A licensed provider should be involved in any plan that includes medical care. A registered dietitian, not just a coach, should write the meal plan. If you cannot find out who is on the team, that tells you something.",
          "In Florida, the provider also needs to be licensed in the state. CorePhia's provider is licensed in Florida, which is why we currently care for adults located in Florida.",
        ],
      },
      {
        h: "How is medication decided?",
        body: [
          "Be careful with any program that talks about medication before it has asked about your health. Whether medication is appropriate depends on your history, your other medications, and your goals, and it is a decision for a licensed provider. A good program tells you up front that medication is sometimes part of the plan and sometimes not.",
        ],
      },
      {
        h: "Is food and exercise part of it?",
        body: [
          "Medication, if it is used at all, does not replace eating well and moving. Look for a program that includes a meal plan and an exercise plan, not only a prescription. Those are what help results last.",
        ],
      },
      {
        h: "What happens after the first visit?",
        body: [
          "Ask how often you will check in and who you can message between visits. A plan that is set once and never reviewed will not fit you for long. Follow-ups are where your plan gets adjusted as your weight, routine, and health change.",
        ],
      },
      {
        h: "What does it cost, and what does that cover?",
        body: [
          "Ask for the full price and what it includes. Find out whether the program bills insurance or is cash pay. CorePhia is cash pay and does not accept insurance. Our membership does not include or guarantee a prescription.",
        ],
      },
    ],
  },
  {
    slug: "what-to-expect-weight-loss-intake",
    reviewed: false,
    program: "medical-care",
    name: "What to expect when you start a weight loss program",
    title: "What to Expect When You Start a Weight Loss Program | CorePhia",
    description:
      "What happens when you start a medical weight loss program: the health questions you will answer, how your provider uses them, and what to have ready.",
    intro:
      "Starting a medical weight loss program begins with questions, not a prescription. The answers you give let your provider understand your health before suggesting anything. Here is what that looks like at CorePhia.",
    sections: [
      {
        h: "What does the intake ask?",
        body: [
          "The CorePhia intake is a short series of questions, one per screen, and takes about ten minutes. It covers your goals, your height and weight, your medical and family history, your medications and allergies, and what a normal day of eating and movement looks like.",
        ],
      },
      {
        h: "What should you have ready?",
        body: [
          [
            "A list of the medications and supplements you take now.",
            "Any conditions you have been diagnosed with, and the ones that run in your family.",
            "Your current weight and height, as close as you can get.",
            "A rough idea of what you eat and how active you are in a normal week.",
          ],
        ],
      },
      {
        h: "What happens after you submit it?",
        body: [
          "A provider reviews what you sent. If CorePhia is a good fit, your provider meets with you, asks anything the intake did not cover, and sets up your plan. Not everyone is a candidate for every part of the program, and your provider decides what is appropriate for you.",
        ],
      },
      {
        h: "Is your information private?",
        body: [
          "Your answers are used for your care. The intake includes a privacy acknowledgement, and our privacy policy and Notice of Privacy Practices explain how your information is handled. You must be 18 or older to apply, and you must be located in Florida for your visits.",
        ],
      },
      {
        h: "Will you be prescribed medication at the first visit?",
        body: [
          "Not automatically. Medication is one possible part of the plan, and your provider decides whether it is clinically appropriate for you. Many patients follow the program without it.",
        ],
      },
    ],
  },
  {
    slug: "what-happens-at-a-weight-loss-follow-up",
    reviewed: false,
    program: "follow-ups",
    name: "What happens at a weight loss follow-up",
    title: "What Happens at a Weight Loss Follow-Up | CorePhia",
    description:
      "What a weight loss follow-up covers: reviewing your progress, adjusting your meal and exercise plans, and how your portal fits in between visits.",
    intro:
      "A follow-up is where a weight loss plan stops being a first draft. Your care team looks at what has happened since the last visit and changes what is not working.",
    sections: [
      {
        h: "What do you talk about?",
        body: [
          "Your provider asks how the plan is going: how you feel, what has been hard, and what has been easier than you expected. They look at your weight trend and anything that has changed in your health or medications.",
        ],
      },
      {
        h: "What gets adjusted?",
        body: [
          [
            "Your meal plan, if portions, foods, or your schedule need to change.",
            "Your exercise plan, by adding to it or easing it back.",
            "Your medications, if you take any: your provider decides whether to continue, change, or stop.",
            "Your next follow-up date.",
          ],
        ],
      },
      {
        h: "What happens between visits?",
        body: [
          "In your patient portal you can log your weight and send messages to your care team. Messages are read during working hours, so the portal is not for urgent problems. In an emergency, call 911.",
        ],
      },
      {
        h: "What if progress slows down?",
        body: [
          "Weight does not drop in a straight line, and a slow week does not mean the plan has failed. A follow-up is the place to look at why: sleep, stress, a missed routine, or a plan that no longer fits. Your provider can then make a change instead of leaving you to guess.",
        ],
      },
      {
        h: "How often are follow-ups?",
        body: [
          "It depends on your plan and what your provider recommends.",
        ],
      },
    ],
  },
  {
    slug: "medical-weight-loss-tampa-florida",
    reviewed: false,
    program: "medical-care",
    name: "Medical weight loss in Tampa, Florida",
    title: "Medical Weight Loss in Tampa, Florida | CorePhia",
    description:
      "CorePhia is a physician-built weight loss program based in Tampa, Florida. What the program includes, who it is for, and how to get started.",
    intro:
      "CorePhia is a physician-built weight loss program based in Tampa, Florida. It brings a licensed provider, a registered dietitian, an exercise plan, and regular follow-ups into one program, and it is open to adults located in Florida.",
    sections: [
      {
        h: "What does a Tampa weight loss program include?",
        body: [
          "CorePhia has four parts that work together: medical care from a licensed provider, dietitian services, a comprehensive exercise plan, and follow-ups. Weight loss medication is part of the program only when your provider decides it is clinically appropriate for you.",
        ],
      },
      {
        h: "Who is it for?",
        body: [
          "CorePhia is for adults, 18 or older, who live in Florida and want a provider guiding their weight loss. It can fit people who have tried to lose weight on their own, people whose weight is affecting their health, and people who want a plan built around their own habits instead of a template.",
        ],
      },
      {
        h: "Do you have to live in Tampa?",
        body: [
          "No. We are based in Tampa, but you need to be located in Florida at each visit, because our provider is licensed in Florida. We cannot care for patients outside the state right now.",
        ],
      },
      {
        h: "How do you get started?",
        body: [
          "Start with the intake. It takes about ten minutes and asks about your goals and your health. A provider reviews it, and if CorePhia fits, you move on to your plan. CorePhia is cash pay and does not accept insurance.",
        ],
      },
    ],
  },
  {
    slug: "why-weight-loss-slows-down",
    reviewed: false,
    program: "follow-ups",
    name: "Why weight loss slows down, and what to do about it",
    title: "Why Weight Loss Slows Down and What to Do | CorePhia",
    description:
      "Why weight loss slows or stalls after the first few weeks, what you can check yourself, and when to bring it to your provider.",
    intro:
      "Nearly everyone sees weight loss slow down at some point. It is frustrating, and it does not mean you did something wrong. Knowing the usual reasons makes it easier to decide what to change.",
    sections: [
      {
        h: "Is it normal for weight loss to slow down?",
        body: [
          "Yes. Weight does not fall in a straight line. It moves up and down from day to day with fluid, salt, sleep, and the timing of meals, so a single week tells you little. Look at the trend over several weeks before you decide anything has stalled.",
        ],
      },
      {
        h: "What causes a plateau?",
        body: [
          [
            "Your routine has drifted. Portions creep up and workouts get skipped, usually without you noticing.",
            "Your body is smaller, so the same plan does less than it did at the start.",
            "Sleep or stress has changed. Both affect appetite and energy.",
            "A new medication or health change is affecting your weight.",
            "The plan was too strict to keep up, and you have loosened it.",
          ],
        ],
      },
      {
        h: "What can you check yourself?",
        body: [
          "Look back over the last two weeks. Did the meals and the exercise match the plan? Are you sleeping enough? Has anything changed in your life or your medications? Writing down what you eat for a few days often shows something you did not expect.",
        ],
      },
      {
        h: "What should you avoid?",
        body: [
          "Cutting food sharply or adding a lot of exercise overnight tends to backfire, because it is hard to keep up. Small changes you can hold for weeks work better. If you take medication, do not change the dose on your own.",
        ],
      },
      {
        h: "When should you talk to your provider?",
        body: [
          "If your weight has not moved for several weeks while you are following the plan, bring it to your care team. In the CorePhia portal you can log your weight and message them between visits, and your plan can be adjusted at your next follow-up. If you feel unwell or have a new symptom, contact your provider instead of waiting. In an emergency, call 911.",
        ],
      },
    ],
  },
]
