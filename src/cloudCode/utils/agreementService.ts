import OpenAI from 'openai';

const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const SYSTEM_PROMPT = `
You are an agreement JSON generator/updater. You MUST output ONLY valid JSON with this shape:
{
  "agreement": { ... },
  "meta": {
    "source": "generate" | "update",
    "change_log": [ { "path": "a.b.c", "old": any, "new": any, "reason": "..." } ],
    "notes": string[],
    "missing_info": string[]
  }
}

CRITICAL RULES:
- For "generate":
  - Build the agreement ONLY from the provided chat messages.
  - If a field is not present in chat, do NOT invent values; leave empty/omitted and add a label to meta.missing_info.
- For "update":
  - Start from the provided currentAgreement.
  - Apply ONLY the edits explicitly requested in the updatePrompt.
  - All other fields MUST remain identical to currentAgreement.
  - For each change, add an entry to meta.change_log (path, old, new, reason referencing the updatePrompt).
- Never include text outside the JSON. No markdown, no commentary.
`.trim();

const GENERATE_USER_PROMPT = (conversations: unknown) =>
  `
TASK: Generate a new agreement from chat only.

CHAT:
${JSON.stringify(conversations, null, 2)}

OUTPUT:
- agreement built strictly from chat content
- meta.source = "generate"
- meta.missing_info lists any fields you could not fill due to lack of data
- meta.change_log can be empty for generate
`.trim();

const UPDATE_USER_PROMPT = (currentAgreement: unknown, updatePrompt: string) =>
  `
TASK: Update an existing agreement by applying ONLY the requested changes.
Do NOT add information from outside the updatePrompt.

CURRENT AGREEMENT:
${JSON.stringify(currentAgreement, null, 2)}

UPDATE PROMPT (what to change exactly):
${updatePrompt}

OUTPUT:
- agreement identical to currentAgreement EXCEPT the precise changes requested
- meta.source = "update"
- meta.change_log entries for every changed path with reason referencing the updatePrompt
- meta.missing_info for any change you could not apply due to missing specifics
`.trim();

type Role = 'Client' | 'Broker' | 'Seller' | 'Buyer' | string;

export interface Conversation {
  username: string;
  conversation: string;
  role: Role;
}

export interface Agreement {
  [k: string]: any;
}

export interface AgreementResponse {
  agreement: Agreement;
  meta: {
    source: 'generate' | 'update';
    change_log: Array<{path: string; old?: any; new?: any; reason?: string}>;
    notes?: string[];
    missing_info?: string[];
  };
}

export type AgreementGenerateRequest = {
  mode: 'generate';
  conversations: Conversation[];
};

export type AgreementUpdateRequest = {
  mode: 'update';
  currentAgreement: Agreement;
  updatePrompt: string;
};

export type AgreementRequest =
  | AgreementGenerateRequest
  | AgreementUpdateRequest;

export async function generateOrUpdateAgreement(
  payload: AgreementRequest
): Promise<AgreementResponse> {
  const systemPrompt = SYSTEM_PROMPT;

  const userPrompt =
    payload.mode === 'generate'
      ? GENERATE_USER_PROMPT(payload.conversations)
      : UPDATE_USER_PROMPT(payload.currentAgreement, payload.updatePrompt);

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {role: 'system', content: systemPrompt},
      {role: 'user', content: userPrompt},
    ],
    response_format: {type: 'json_object'},
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(content) as AgreementResponse;
  parsed.meta = parsed.meta || ({} as any);
  parsed.meta.source = payload.mode;

  return parsed;
}
