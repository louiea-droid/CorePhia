// Patient success stories for /success-stories. Empty on purpose.
//
// Only add a story that is real and consented (docs/website-feedback-plan.md,
// section 7). Each one needs:
//   - a signed HIPAA authorization from the patient to publish it (their photos
//     and results are PHI), with the date recorded below
//   - numbers that match the patient's chart
//   - credit to the program, never to a medication alone (CLAUDE.md)
// No invented patients, and no stock or AI photos presented as patients. The
// FTC treats those as deceptive endorsements, and weight loss is the area it
// watches most closely.
//
// Shape of one story:
// {
//   id: "zachary-2027",           // stable key
//   name: "Zachary",               // first name only
//   age: 43,
//   poundsLost: 119,
//   months: 9,
//   quote: "Optional, in the patient's own words.",
//   photos: { before: "/stories/zachary-before.webp", after: "/stories/zachary-after.webp" },
//   consentSignedOn: "2027-01-15", // date of the signed authorization
// }
export const successStories = []
