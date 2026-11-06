import "server-only";
import { createHash } from "node:crypto";
import { FIXED_ANSWERS } from "./fixed";
import { OFFER_FACTS } from "./knowledge";
import { systemPrompt } from "./prompt";

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

/** Taken from the content itself, so any change makes a new version and nobody has to remember to bump it. */
export const promptVersion = () => hash(systemPrompt());
export const factsVersion = () => hash(`${OFFER_FACTS}\n${FIXED_ANSWERS.join("\n")}`);
