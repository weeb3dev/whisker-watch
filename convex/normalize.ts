import type { Doc } from "./_generated/dataModel";

export type Coat = Doc<"listings">["coat"];
export type Age = Doc<"listings">["age"];

// Order matters: "Domestic Long Hair & Tabby" must resolve long before
// the tabby pattern resolves short.
const COAT_PATTERNS: Array<[RegExp, Coat]> = [
  [/long\s*hair|persian|maine\s*coon|ragdoll|himalayan|norwegian|birman|balinese/i, "long"],
  [/medium\s*hair/i, "medium"],
  [/sphynx|hairless|peterbald|donskoy/i, "hairless"],
  [/short\s*hair|siamese|bengal|bombay|burmese|russian\s*blue|tabby|abyssinian|american\s*curl/i, "short"],
];

export function coatFromText(text: string): Coat {
  for (const [pattern, coat] of COAT_PATTERNS) {
    if (pattern.test(text)) return coat;
  }
  return "unknown";
}

const AGE_PATTERNS: Array<[RegExp, Age]> = [
  [/kitten|baby/i, "kitten"],
  [/young/i, "young"],
  [/senior/i, "senior"],
  [/adult/i, "adult"],
];

export function ageFromText(text: string): Age {
  for (const [pattern, age] of AGE_PATTERNS) {
    if (pattern.test(text)) return age;
  }
  return "unknown";
}
