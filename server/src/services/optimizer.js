
import Groq from "groq-sdk";

const COMMON_INSTRUCTIONS = `
Improve the draft prompt while preserving its intent, facts, constraints,
and desired outcome. Enhance clarity and structure without inventing details.
Make reasonable assumptions when information is missing. If the prompt is
too vague to interpret confidently, return exactly: "Please provide a clearer prompt."
Return only the improved prompt, without commentary or explanation.
`;

export const MODE_INSTRUCTIONS = Object.freeze({
  BASIC: `
Focus on general clarity, concise wording, logical structure, and flow.
`,

  LEARNING: `
Focus on learning and understanding. Where relevant, clarify the topic
and learning level, and include simple explanations, step-by-step guidance,
examples, or analogies where useful.
`,

  CODING: `
Focus on programming and software development. Where relevant, clarify
the language, framework, environment, expected behavior, inputs, outputs,
and constraints. Do not invent technical requirements.
`,

  WRITING: `
Focus on writing and content creation. Where relevant, clarify the
audience, purpose, tone, style, format, and length while preserving
the author's intended meaning and voice.
`
});

export async function optimizePrompt(prompt, mode = "BASIC") {
  // Construct only when needed; the API server can start before a key is configured.
  const optimizerInstructions = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.BASIC;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const result = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    temperature: 0.3,
    messages: [
      { role: "system", content: `${COMMON_INSTRUCTIONS} \n\n mode:${optimizerInstructions}` },
      { role: "user", content: prompt },
    ],
  });

  const optimizedPrompt = result.choices[0]?.message?.content?.trim();
  if (!optimizedPrompt) throw new Error("The model returned an empty response.");
  return optimizedPrompt;
}


// IN The ui of this app , we have custom optimisation techniques set up , that define the tone and the refine the prompt in a particular way as per what we want 
// the interesting part here is that the react states in the considerations 
// we had the useState() , useEffect() , that manipullate the dynamic UI as the values they hold 
// change , the interesting part here is that we also enable the undo option and keyborad event option
// the keyborad thing is that a particular method gets striked by a pressing of alt+shift+[p]
// also that undo option saves the sent in prompt so we can compare it with the type pf content we sent in it . 
// The interesting part here i think , we can also provide them the choice of using their own api for groq to get unlimited uses 
// that is as simple as it gets , the intersting parts is just pick and drop . 
// just pick and drop for both the custom tonalies and output for the prompt as well as we can pick and drop groq api in the mix , that will help us all .

// also how to make sure what prompt is sent in as an request . 
// i have to make sure that we identify what is the prompt in the given image .
// thus it go work only when i am working with AI agents , that is the key here 
// thus be it a claude , gemini , open - ai , i can idenntyf the text and sent it in the desired folder 
// it does not work on a for a word doc  or something similar etc .

// on the promptRefine page at the top i want to make some marks where a different type of  an prompt optimisation can be done 
// this help create reusability and custom use cases for the users .
