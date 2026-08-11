import type { DomainEvent } from "../contracts.js";

export interface CausalLink { readonly parentEventId: string; readonly childEventId: string; readonly relationship: "caused-by" | "followed-by" | "correlated-with"; }
export interface CausalityChain { readonly rootEventId: string; readonly links: readonly CausalLink[]; readonly depth: number; readonly totalEvents: number; }

export function buildCausalityChain(events: readonly DomainEvent[], rootEventId: string, maxDepth = 10): CausalityChain {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  if (!eventMap.has(rootEventId)) return { rootEventId, links: [], depth: 0, totalEvents: 0 };
  const links: CausalLink[] = [];
  const visited = new Set([rootEventId]);
  const queue = [{ eventId: rootEventId, depth: 0 }];
  let depth = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const currentEvent = eventMap.get(current.eventId)!;
    const next = events.filter((event) => event.leadId === currentEvent.leadId && event.occurredAt > currentEvent.occurredAt && !visited.has(event.id))
      .sort((left, right) => left.occurredAt - right.occurredAt || left.sequence - right.sequence || left.id.localeCompare(right.id))[0];
    if (!next) continue;
    const relationship: CausalLink["relationship"] = next.category === currentEvent.category ? "followed-by" : "caused-by";
    links.push({ parentEventId: current.eventId, childEventId: next.id, relationship });
    visited.add(next.id);
    depth = Math.max(depth, current.depth + 1);
    queue.push({ eventId: next.id, depth: current.depth + 1 });
  }
  return { rootEventId, links, depth, totalEvents: visited.size };
}
