import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEMO, SITE_URL } from "@/lib/config";
import { CATEGORIES } from "@/lib/onboarding/catalog";
import { ASSISTANT_SYSTEM } from "@/lib/public/assistant-prompt";
import { getSiteTexts } from "@/lib/public/content";
import { BUDGETS, searchDirectory } from "@/lib/public/data";
import { clientIp, rateLimited } from "@/lib/public/guard";

/*
 * Assistant public. La clé ANTHROPIC_API_KEY reste côté serveur et rien n'est enregistré ici :
 * l'historique vit dans le navigateur et revient à chaque question, avec des limites de taille.
 * Réponse en flux, une ligne JSON par événement : texte, relais vers un humain, erreur.
 */
const MODEL = "claude-opus-5-5";
const MAX_TURNS = 20;
const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(MAX_TURNS),
}).refine(({ messages }) => messages[0].role === "user" && messages.at(-1)?.role === "user" && messages.at(-1)!.content.length <= 800);

type Event = { t: "text"; v: string } | { t: "handoff"; url?: string } | { t: "error"; v: string };

const handoffUrl = (number: string, summary: string) => {
  const text = `Bonjour NDOA, je viens de l’assistant du site.\n${summary}`.slice(0, 900);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

const tools = (send: (e: Event) => void, whatsapp: string) => [
  betaZodTool({
    name: "search_vendors",
    description: "Cherche dans l'annuaire les prestataires publiés sur NDOA Wedding. À utiliser pour toute question sur des prestataires, leurs prix ou leurs notes. Renvoie au plus 5 résultats.",
    inputSchema: z.object({
      query: z.string().max(80).optional().describe("Mots-clés : nom, style, quartier"),
      categorie: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]).optional().describe("Métier recherché"),
      ville: z.string().max(60).optional().describe("Ville exacte, par exemple Kinshasa"),
      budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]]).optional().describe("Tranche de prix de départ, en dollars"),
    }),
    eager_input_streaming: true,
    run: async ({ query, categorie, ville, budget }) => {
      const res = await searchDirectory({ q: query, categorie, ville, budget, page: 1 });
      return JSON.stringify({
        total: res.total,
        prestataires: res.items.slice(0, 5).map((v) => ({
          nom: v.name, metier: v.catName, ville: v.city, a_partir_de_usd: v.price,
          note: v.reviews ? v.rating : null, avis: v.reviews, lien: `/prestataires/${v.slug}`,
        })),
      });
    },
  }),
  betaZodTool({
    name: "handoff_to_human",
    description: "Propose à la personne de continuer avec un conseiller NDOA sur WhatsApp : un bouton s'affiche, et c'est elle qui décide de l'ouvrir. À utiliser quand elle le demande ou quand le sujet dépasse ce que l'assistant peut régler.",
    inputSchema: z.object({
      summary: z.string().min(1).max(500).describe("Résumé fidèle de la demande en une ou deux phrases, à la première personne, pour pré-remplir son message. Uniquement ce que la personne a écrit, sans rien inventer."),
    }),
    eager_input_streaming: true,
    run: async ({ summary }) => {
      if (!whatsapp) {
        send({ t: "handoff" });
        return "Aucun numéro WhatsApp n'est configuré : oriente la personne vers la page /contact.";
      }
      send({ t: "handoff", url: handoffUrl(whatsapp, summary) });
      return "Le bouton WhatsApp est affiché à la personne.";
    },
  }),
];

function stream(run: (send: (e: Event) => void) => Promise<void>) {
  const body = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      await run((e) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`)));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  // Seul le site lui-même peut appeler ce service, et chaque question a un coût
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin && origin !== SITE_URL) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const ip = clientIp(req);
  if (rateLimited(`assistant:${ip}`, 15, 10 * 60 * 1000) || rateLimited(`assistant-jour:${ip}`, 60, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Vous avez posé beaucoup de questions. Réessayez un peu plus tard, ou écrivez-nous depuis la page Contact." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  const { messages } = parsed.data;

  if (DEMO) {
    const human = /humain|conseiller|personne|litige|rembours/i.test(messages.at(-1)!.content);
    return stream(async (send) => {
      const reply = human
        ? "Je vous mets en relation avec un conseiller NDOA : utilisez le bouton ci-dessous pour continuer."
        : "Mode démo : je ne suis pas relié au vrai assistant ici. Vous pouvez consulter /prestataires ou calculer votre budget sur /budget-mariage.";
      for (const word of reply.split(/(?<= )/)) {
        send({ t: "text", v: word });
        await new Promise((r) => setTimeout(r, 35));
      }
      if (human) send({ t: "handoff", url: handoffUrl("243000000000", messages.at(-1)!.content.slice(0, 300)) });
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "L’assistant n’est pas disponible pour le moment." }, { status: 503 });

  const texts = await getSiteTexts();
  const whatsapp = (texts.contactWhatsapp ?? ENV_WHATSAPP).replace(/\D/g, "");
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });

  return stream(async (send) => {
    try {
      const runner = client.beta.messages.toolRunner({
        model: MODEL,
        max_tokens: 1500, // plafond de coût : les réponses attendues sont courtes
        max_iterations: 4,
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: ASSISTANT_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: tools(send, whatsapp),
        messages,
        stream: true,
      });
      for await (const turn of runner) {
        for await (const event of turn) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: "text", v: event.delta.text });
        }
        const message = await turn.finalMessage();
        if (message.stop_reason === "refusal") {
          send({ t: "text", v: "Je ne peux pas vous aider sur ce point, mais l’équipe NDOA reste disponible depuis la page /contact." });
          break;
        }
        // Une entrée d'outil tronquée peut sembler valide : on ne l'exécute pas
        if (message.stop_reason === "max_tokens" && message.content.some((b) => b.type === "tool_use")) {
          send({ t: "error", v: "Je n’ai pas pu terminer. Pouvez-vous reformuler votre question ?" });
          break;
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        send({ t: "error", v: "Beaucoup de demandes en ce moment. Réessayez dans un instant." });
      } else {
        console.error("assistant", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        send({ t: "error", v: "L’assistant est momentanément indisponible. Vous pouvez nous écrire depuis la page /contact." });
      }
    }
  });
}
