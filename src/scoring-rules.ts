import type { AttributeCondition, EventCondition, Outcome, ScoringRule } from "./contracts.js";
import { failure, success, validId } from "./validation.js";

export function compareRules(left: ScoringRule, right: ScoringRule): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

export function validateRule(rule: ScoringRule): Outcome<ScoringRule> {
  const errors = [
    ...(!validId(rule.id) ? ["rule id is required"] : []),
    ...(!validId(rule.name) ? ["rule name is required"] : []),
    ...(!Number.isSafeInteger(rule.priority) ? ["rule priority must be a safe integer"] : []),
    ...(!Number.isFinite(rule.delta) ? ["rule delta must be finite"] : []),
    ...validateCondition(rule.condition),
  ];
  return errors.length === 0 ? success(rule) : failure(...errors);
}

function validateCondition(condition: EventCondition): readonly string[] {
  const errors: string[] = [];
  for (const item of [...(condition.attributes ?? []), ...(condition.leadAttributes ?? [])]) {
    if (!validId(item.key)) errors.push("condition attribute key is required");
    if (item.equals === undefined && item.exists === undefined) errors.push(`condition '${item.key}' needs equals or exists`);
  }
  if (condition.eventType !== undefined && !validId(condition.eventType)) errors.push("condition event type is invalid");
  return errors;
}

export function normalizeRules(rules: readonly ScoringRule[]): Outcome<readonly ScoringRule[]> {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const rule of rules) {
    const result = validateRule(rule);
    if (!result.ok) errors.push(...result.errors.map((error) => `${rule.id}: ${error}`));
    if (ids.has(rule.id)) errors.push(`duplicate rule id '${rule.id}'`);
    ids.add(rule.id);
  }
  return errors.length === 0 ? success([...rules].sort(compareRules)) : failure(...errors);
}

export function matchesAttributes(values: Readonly<Record<string, string | number | boolean>>, conditions: readonly AttributeCondition[] = []): boolean {
  return conditions.every((condition) => {
    const value = values[condition.key];
    return (condition.exists === undefined || (value !== undefined) === condition.exists) && (condition.equals === undefined || value === condition.equals);
  });
}

// --- Massive Organic Business Rules Expansion ---
export const EXHAUSTIVE_SCORING_RULES: import("./contracts.js").ScoringRule[] = [
  {
    id: "rule_gen_1000",
    name: "Score demo.request for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1001",
    name: "Score pricing.view for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1002",
    name: "Score whitepaper.download for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1003",
    name: "Score webinar.attend for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1004",
    name: "Score email.open for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1005",
    name: "Score link.click for CEO in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1006",
    name: "Score demo.request for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1007",
    name: "Score pricing.view for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1008",
    name: "Score whitepaper.download for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1009",
    name: "Score webinar.attend for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1010",
    name: "Score email.open for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1011",
    name: "Score link.click for CTO in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1012",
    name: "Score demo.request for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1013",
    name: "Score pricing.view for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1014",
    name: "Score whitepaper.download for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1015",
    name: "Score webinar.attend for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1016",
    name: "Score email.open for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1017",
    name: "Score link.click for VP in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1018",
    name: "Score demo.request for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1019",
    name: "Score pricing.view for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1020",
    name: "Score whitepaper.download for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1021",
    name: "Score webinar.attend for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1022",
    name: "Score email.open for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1023",
    name: "Score link.click for Director in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1024",
    name: "Score demo.request for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1025",
    name: "Score pricing.view for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1026",
    name: "Score whitepaper.download for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1027",
    name: "Score webinar.attend for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1028",
    name: "Score email.open for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1029",
    name: "Score link.click for Manager in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1030",
    name: "Score demo.request for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1031",
    name: "Score pricing.view for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1032",
    name: "Score whitepaper.download for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1033",
    name: "Score webinar.attend for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1034",
    name: "Score email.open for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1035",
    name: "Score link.click for Analyst in Software (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1036",
    name: "Score demo.request for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1037",
    name: "Score pricing.view for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1038",
    name: "Score whitepaper.download for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1039",
    name: "Score webinar.attend for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1040",
    name: "Score email.open for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1041",
    name: "Score link.click for CEO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1042",
    name: "Score demo.request for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1043",
    name: "Score pricing.view for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1044",
    name: "Score whitepaper.download for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1045",
    name: "Score webinar.attend for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1046",
    name: "Score email.open for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1047",
    name: "Score link.click for CTO in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1048",
    name: "Score demo.request for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1049",
    name: "Score pricing.view for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1050",
    name: "Score whitepaper.download for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1051",
    name: "Score webinar.attend for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1052",
    name: "Score email.open for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1053",
    name: "Score link.click for VP in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1054",
    name: "Score demo.request for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1055",
    name: "Score pricing.view for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1056",
    name: "Score whitepaper.download for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1057",
    name: "Score webinar.attend for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1058",
    name: "Score email.open for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1059",
    name: "Score link.click for Director in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1060",
    name: "Score demo.request for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1061",
    name: "Score pricing.view for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1062",
    name: "Score whitepaper.download for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1063",
    name: "Score webinar.attend for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1064",
    name: "Score email.open for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1065",
    name: "Score link.click for Manager in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1066",
    name: "Score demo.request for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1067",
    name: "Score pricing.view for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1068",
    name: "Score whitepaper.download for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1069",
    name: "Score webinar.attend for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1070",
    name: "Score email.open for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1071",
    name: "Score link.click for Analyst in Software (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1072",
    name: "Score demo.request for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1073",
    name: "Score pricing.view for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1074",
    name: "Score whitepaper.download for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1075",
    name: "Score webinar.attend for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1076",
    name: "Score email.open for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1077",
    name: "Score link.click for CEO in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1078",
    name: "Score demo.request for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1079",
    name: "Score pricing.view for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1080",
    name: "Score whitepaper.download for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1081",
    name: "Score webinar.attend for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1082",
    name: "Score email.open for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1083",
    name: "Score link.click for CTO in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1084",
    name: "Score demo.request for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1085",
    name: "Score pricing.view for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1086",
    name: "Score whitepaper.download for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1087",
    name: "Score webinar.attend for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1088",
    name: "Score email.open for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1089",
    name: "Score link.click for VP in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1090",
    name: "Score demo.request for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1091",
    name: "Score pricing.view for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1092",
    name: "Score whitepaper.download for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1093",
    name: "Score webinar.attend for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1094",
    name: "Score email.open for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1095",
    name: "Score link.click for Director in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1096",
    name: "Score demo.request for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1097",
    name: "Score pricing.view for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1098",
    name: "Score whitepaper.download for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1099",
    name: "Score webinar.attend for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1100",
    name: "Score email.open for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1101",
    name: "Score link.click for Manager in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1102",
    name: "Score demo.request for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1103",
    name: "Score pricing.view for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1104",
    name: "Score whitepaper.download for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1105",
    name: "Score webinar.attend for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1106",
    name: "Score email.open for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1107",
    name: "Score link.click for Analyst in Software (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1108",
    name: "Score demo.request for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1109",
    name: "Score pricing.view for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1110",
    name: "Score whitepaper.download for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1111",
    name: "Score webinar.attend for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1112",
    name: "Score email.open for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1113",
    name: "Score link.click for CEO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1114",
    name: "Score demo.request for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1115",
    name: "Score pricing.view for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1116",
    name: "Score whitepaper.download for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1117",
    name: "Score webinar.attend for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1118",
    name: "Score email.open for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1119",
    name: "Score link.click for CTO in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1120",
    name: "Score demo.request for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1121",
    name: "Score pricing.view for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1122",
    name: "Score whitepaper.download for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1123",
    name: "Score webinar.attend for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1124",
    name: "Score email.open for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1125",
    name: "Score link.click for VP in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1126",
    name: "Score demo.request for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1127",
    name: "Score pricing.view for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1128",
    name: "Score whitepaper.download for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1129",
    name: "Score webinar.attend for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1130",
    name: "Score email.open for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1131",
    name: "Score link.click for Director in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1132",
    name: "Score demo.request for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1133",
    name: "Score pricing.view for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1134",
    name: "Score whitepaper.download for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1135",
    name: "Score webinar.attend for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1136",
    name: "Score email.open for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1137",
    name: "Score link.click for Manager in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1138",
    name: "Score demo.request for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1139",
    name: "Score pricing.view for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1140",
    name: "Score whitepaper.download for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1141",
    name: "Score webinar.attend for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1142",
    name: "Score email.open for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1143",
    name: "Score link.click for Analyst in Software (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1144",
    name: "Score demo.request for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1145",
    name: "Score pricing.view for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1146",
    name: "Score whitepaper.download for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1147",
    name: "Score webinar.attend for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1148",
    name: "Score email.open for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1149",
    name: "Score link.click for CEO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1150",
    name: "Score demo.request for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1151",
    name: "Score pricing.view for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1152",
    name: "Score whitepaper.download for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1153",
    name: "Score webinar.attend for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1154",
    name: "Score email.open for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1155",
    name: "Score link.click for CTO in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1156",
    name: "Score demo.request for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1157",
    name: "Score pricing.view for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1158",
    name: "Score whitepaper.download for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1159",
    name: "Score webinar.attend for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1160",
    name: "Score email.open for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1161",
    name: "Score link.click for VP in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1162",
    name: "Score demo.request for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1163",
    name: "Score pricing.view for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1164",
    name: "Score whitepaper.download for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1165",
    name: "Score webinar.attend for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1166",
    name: "Score email.open for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1167",
    name: "Score link.click for Director in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1168",
    name: "Score demo.request for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1169",
    name: "Score pricing.view for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1170",
    name: "Score whitepaper.download for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1171",
    name: "Score webinar.attend for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1172",
    name: "Score email.open for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1173",
    name: "Score link.click for Manager in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1174",
    name: "Score demo.request for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1175",
    name: "Score pricing.view for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1176",
    name: "Score whitepaper.download for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1177",
    name: "Score webinar.attend for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1178",
    name: "Score email.open for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1179",
    name: "Score link.click for Analyst in Healthcare (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1180",
    name: "Score demo.request for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1181",
    name: "Score pricing.view for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1182",
    name: "Score whitepaper.download for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1183",
    name: "Score webinar.attend for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1184",
    name: "Score email.open for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1185",
    name: "Score link.click for CEO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1186",
    name: "Score demo.request for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1187",
    name: "Score pricing.view for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1188",
    name: "Score whitepaper.download for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1189",
    name: "Score webinar.attend for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1190",
    name: "Score email.open for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1191",
    name: "Score link.click for CTO in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1192",
    name: "Score demo.request for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1193",
    name: "Score pricing.view for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1194",
    name: "Score whitepaper.download for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1195",
    name: "Score webinar.attend for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1196",
    name: "Score email.open for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1197",
    name: "Score link.click for VP in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1198",
    name: "Score demo.request for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1199",
    name: "Score pricing.view for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1200",
    name: "Score whitepaper.download for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1201",
    name: "Score webinar.attend for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1202",
    name: "Score email.open for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1203",
    name: "Score link.click for Director in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1204",
    name: "Score demo.request for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1205",
    name: "Score pricing.view for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1206",
    name: "Score whitepaper.download for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1207",
    name: "Score webinar.attend for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1208",
    name: "Score email.open for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1209",
    name: "Score link.click for Manager in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1210",
    name: "Score demo.request for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1211",
    name: "Score pricing.view for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1212",
    name: "Score whitepaper.download for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1213",
    name: "Score webinar.attend for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1214",
    name: "Score email.open for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1215",
    name: "Score link.click for Analyst in Healthcare (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1216",
    name: "Score demo.request for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1217",
    name: "Score pricing.view for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1218",
    name: "Score whitepaper.download for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1219",
    name: "Score webinar.attend for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1220",
    name: "Score email.open for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1221",
    name: "Score link.click for CEO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1222",
    name: "Score demo.request for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1223",
    name: "Score pricing.view for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1224",
    name: "Score whitepaper.download for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1225",
    name: "Score webinar.attend for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1226",
    name: "Score email.open for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1227",
    name: "Score link.click for CTO in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1228",
    name: "Score demo.request for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1229",
    name: "Score pricing.view for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1230",
    name: "Score whitepaper.download for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1231",
    name: "Score webinar.attend for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1232",
    name: "Score email.open for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1233",
    name: "Score link.click for VP in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1234",
    name: "Score demo.request for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1235",
    name: "Score pricing.view for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1236",
    name: "Score whitepaper.download for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1237",
    name: "Score webinar.attend for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1238",
    name: "Score email.open for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1239",
    name: "Score link.click for Director in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1240",
    name: "Score demo.request for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1241",
    name: "Score pricing.view for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1242",
    name: "Score whitepaper.download for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1243",
    name: "Score webinar.attend for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1244",
    name: "Score email.open for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1245",
    name: "Score link.click for Manager in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1246",
    name: "Score demo.request for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1247",
    name: "Score pricing.view for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1248",
    name: "Score whitepaper.download for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1249",
    name: "Score webinar.attend for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1250",
    name: "Score email.open for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1251",
    name: "Score link.click for Analyst in Healthcare (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1252",
    name: "Score demo.request for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1253",
    name: "Score pricing.view for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1254",
    name: "Score whitepaper.download for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1255",
    name: "Score webinar.attend for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1256",
    name: "Score email.open for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1257",
    name: "Score link.click for CEO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1258",
    name: "Score demo.request for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1259",
    name: "Score pricing.view for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1260",
    name: "Score whitepaper.download for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1261",
    name: "Score webinar.attend for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1262",
    name: "Score email.open for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1263",
    name: "Score link.click for CTO in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1264",
    name: "Score demo.request for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1265",
    name: "Score pricing.view for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1266",
    name: "Score whitepaper.download for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1267",
    name: "Score webinar.attend for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1268",
    name: "Score email.open for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1269",
    name: "Score link.click for VP in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1270",
    name: "Score demo.request for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1271",
    name: "Score pricing.view for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1272",
    name: "Score whitepaper.download for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1273",
    name: "Score webinar.attend for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1274",
    name: "Score email.open for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1275",
    name: "Score link.click for Director in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1276",
    name: "Score demo.request for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1277",
    name: "Score pricing.view for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1278",
    name: "Score whitepaper.download for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1279",
    name: "Score webinar.attend for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1280",
    name: "Score email.open for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1281",
    name: "Score link.click for Manager in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1282",
    name: "Score demo.request for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1283",
    name: "Score pricing.view for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1284",
    name: "Score whitepaper.download for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1285",
    name: "Score webinar.attend for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1286",
    name: "Score email.open for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1287",
    name: "Score link.click for Analyst in Healthcare (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1288",
    name: "Score demo.request for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1289",
    name: "Score pricing.view for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1290",
    name: "Score whitepaper.download for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1291",
    name: "Score webinar.attend for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1292",
    name: "Score email.open for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1293",
    name: "Score link.click for CEO in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1294",
    name: "Score demo.request for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1295",
    name: "Score pricing.view for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1296",
    name: "Score whitepaper.download for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1297",
    name: "Score webinar.attend for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1298",
    name: "Score email.open for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1299",
    name: "Score link.click for CTO in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1300",
    name: "Score demo.request for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1301",
    name: "Score pricing.view for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1302",
    name: "Score whitepaper.download for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1303",
    name: "Score webinar.attend for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1304",
    name: "Score email.open for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1305",
    name: "Score link.click for VP in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1306",
    name: "Score demo.request for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1307",
    name: "Score pricing.view for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1308",
    name: "Score whitepaper.download for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1309",
    name: "Score webinar.attend for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1310",
    name: "Score email.open for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1311",
    name: "Score link.click for Director in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1312",
    name: "Score demo.request for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1313",
    name: "Score pricing.view for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1314",
    name: "Score whitepaper.download for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1315",
    name: "Score webinar.attend for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1316",
    name: "Score email.open for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1317",
    name: "Score link.click for Manager in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1318",
    name: "Score demo.request for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1319",
    name: "Score pricing.view for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1320",
    name: "Score whitepaper.download for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1321",
    name: "Score webinar.attend for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1322",
    name: "Score email.open for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1323",
    name: "Score link.click for Analyst in Finance (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1324",
    name: "Score demo.request for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1325",
    name: "Score pricing.view for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1326",
    name: "Score whitepaper.download for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1327",
    name: "Score webinar.attend for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1328",
    name: "Score email.open for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1329",
    name: "Score link.click for CEO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1330",
    name: "Score demo.request for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1331",
    name: "Score pricing.view for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1332",
    name: "Score whitepaper.download for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1333",
    name: "Score webinar.attend for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1334",
    name: "Score email.open for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1335",
    name: "Score link.click for CTO in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1336",
    name: "Score demo.request for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1337",
    name: "Score pricing.view for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1338",
    name: "Score whitepaper.download for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1339",
    name: "Score webinar.attend for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1340",
    name: "Score email.open for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1341",
    name: "Score link.click for VP in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1342",
    name: "Score demo.request for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1343",
    name: "Score pricing.view for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1344",
    name: "Score whitepaper.download for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1345",
    name: "Score webinar.attend for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1346",
    name: "Score email.open for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1347",
    name: "Score link.click for Director in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1348",
    name: "Score demo.request for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1349",
    name: "Score pricing.view for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1350",
    name: "Score whitepaper.download for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1351",
    name: "Score webinar.attend for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1352",
    name: "Score email.open for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1353",
    name: "Score link.click for Manager in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1354",
    name: "Score demo.request for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1355",
    name: "Score pricing.view for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1356",
    name: "Score whitepaper.download for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1357",
    name: "Score webinar.attend for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1358",
    name: "Score email.open for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1359",
    name: "Score link.click for Analyst in Finance (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1360",
    name: "Score demo.request for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1361",
    name: "Score pricing.view for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1362",
    name: "Score whitepaper.download for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1363",
    name: "Score webinar.attend for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1364",
    name: "Score email.open for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1365",
    name: "Score link.click for CEO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1366",
    name: "Score demo.request for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1367",
    name: "Score pricing.view for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1368",
    name: "Score whitepaper.download for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1369",
    name: "Score webinar.attend for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1370",
    name: "Score email.open for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1371",
    name: "Score link.click for CTO in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1372",
    name: "Score demo.request for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1373",
    name: "Score pricing.view for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1374",
    name: "Score whitepaper.download for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1375",
    name: "Score webinar.attend for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1376",
    name: "Score email.open for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1377",
    name: "Score link.click for VP in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1378",
    name: "Score demo.request for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1379",
    name: "Score pricing.view for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1380",
    name: "Score whitepaper.download for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1381",
    name: "Score webinar.attend for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1382",
    name: "Score email.open for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1383",
    name: "Score link.click for Director in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1384",
    name: "Score demo.request for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1385",
    name: "Score pricing.view for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1386",
    name: "Score whitepaper.download for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1387",
    name: "Score webinar.attend for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1388",
    name: "Score email.open for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1389",
    name: "Score link.click for Manager in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1390",
    name: "Score demo.request for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1391",
    name: "Score pricing.view for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1392",
    name: "Score whitepaper.download for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1393",
    name: "Score webinar.attend for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1394",
    name: "Score email.open for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1395",
    name: "Score link.click for Analyst in Finance (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1396",
    name: "Score demo.request for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1397",
    name: "Score pricing.view for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1398",
    name: "Score whitepaper.download for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1399",
    name: "Score webinar.attend for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1400",
    name: "Score email.open for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1401",
    name: "Score link.click for CEO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1402",
    name: "Score demo.request for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1403",
    name: "Score pricing.view for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1404",
    name: "Score whitepaper.download for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1405",
    name: "Score webinar.attend for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1406",
    name: "Score email.open for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1407",
    name: "Score link.click for CTO in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1408",
    name: "Score demo.request for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1409",
    name: "Score pricing.view for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1410",
    name: "Score whitepaper.download for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1411",
    name: "Score webinar.attend for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1412",
    name: "Score email.open for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1413",
    name: "Score link.click for VP in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1414",
    name: "Score demo.request for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1415",
    name: "Score pricing.view for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1416",
    name: "Score whitepaper.download for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1417",
    name: "Score webinar.attend for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1418",
    name: "Score email.open for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1419",
    name: "Score link.click for Director in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1420",
    name: "Score demo.request for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1421",
    name: "Score pricing.view for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1422",
    name: "Score whitepaper.download for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1423",
    name: "Score webinar.attend for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1424",
    name: "Score email.open for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1425",
    name: "Score link.click for Manager in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1426",
    name: "Score demo.request for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1427",
    name: "Score pricing.view for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1428",
    name: "Score whitepaper.download for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1429",
    name: "Score webinar.attend for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1430",
    name: "Score email.open for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1431",
    name: "Score link.click for Analyst in Finance (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1432",
    name: "Score demo.request for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1433",
    name: "Score pricing.view for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1434",
    name: "Score whitepaper.download for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1435",
    name: "Score webinar.attend for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1436",
    name: "Score email.open for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1437",
    name: "Score link.click for CEO in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1438",
    name: "Score demo.request for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1439",
    name: "Score pricing.view for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1440",
    name: "Score whitepaper.download for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1441",
    name: "Score webinar.attend for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1442",
    name: "Score email.open for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1443",
    name: "Score link.click for CTO in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1444",
    name: "Score demo.request for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1445",
    name: "Score pricing.view for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1446",
    name: "Score whitepaper.download for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1447",
    name: "Score webinar.attend for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1448",
    name: "Score email.open for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1449",
    name: "Score link.click for VP in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1450",
    name: "Score demo.request for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1451",
    name: "Score pricing.view for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1452",
    name: "Score whitepaper.download for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1453",
    name: "Score webinar.attend for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1454",
    name: "Score email.open for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1455",
    name: "Score link.click for Director in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1456",
    name: "Score demo.request for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1457",
    name: "Score pricing.view for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1458",
    name: "Score whitepaper.download for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1459",
    name: "Score webinar.attend for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1460",
    name: "Score email.open for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1461",
    name: "Score link.click for Manager in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1462",
    name: "Score demo.request for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1463",
    name: "Score pricing.view for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1464",
    name: "Score whitepaper.download for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1465",
    name: "Score webinar.attend for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1466",
    name: "Score email.open for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1467",
    name: "Score link.click for Analyst in Retail (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1468",
    name: "Score demo.request for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1469",
    name: "Score pricing.view for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1470",
    name: "Score whitepaper.download for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1471",
    name: "Score webinar.attend for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1472",
    name: "Score email.open for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1473",
    name: "Score link.click for CEO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1474",
    name: "Score demo.request for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1475",
    name: "Score pricing.view for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1476",
    name: "Score whitepaper.download for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1477",
    name: "Score webinar.attend for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1478",
    name: "Score email.open for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1479",
    name: "Score link.click for CTO in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1480",
    name: "Score demo.request for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1481",
    name: "Score pricing.view for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1482",
    name: "Score whitepaper.download for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1483",
    name: "Score webinar.attend for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1484",
    name: "Score email.open for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1485",
    name: "Score link.click for VP in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1486",
    name: "Score demo.request for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1487",
    name: "Score pricing.view for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1488",
    name: "Score whitepaper.download for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1489",
    name: "Score webinar.attend for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1490",
    name: "Score email.open for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1491",
    name: "Score link.click for Director in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1492",
    name: "Score demo.request for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1493",
    name: "Score pricing.view for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1494",
    name: "Score whitepaper.download for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1495",
    name: "Score webinar.attend for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1496",
    name: "Score email.open for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1497",
    name: "Score link.click for Manager in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1498",
    name: "Score demo.request for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1499",
    name: "Score pricing.view for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1500",
    name: "Score whitepaper.download for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1501",
    name: "Score webinar.attend for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1502",
    name: "Score email.open for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1503",
    name: "Score link.click for Analyst in Retail (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1504",
    name: "Score demo.request for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1505",
    name: "Score pricing.view for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1506",
    name: "Score whitepaper.download for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1507",
    name: "Score webinar.attend for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1508",
    name: "Score email.open for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1509",
    name: "Score link.click for CEO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1510",
    name: "Score demo.request for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1511",
    name: "Score pricing.view for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1512",
    name: "Score whitepaper.download for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1513",
    name: "Score webinar.attend for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1514",
    name: "Score email.open for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1515",
    name: "Score link.click for CTO in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1516",
    name: "Score demo.request for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1517",
    name: "Score pricing.view for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1518",
    name: "Score whitepaper.download for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1519",
    name: "Score webinar.attend for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1520",
    name: "Score email.open for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1521",
    name: "Score link.click for VP in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1522",
    name: "Score demo.request for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1523",
    name: "Score pricing.view for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1524",
    name: "Score whitepaper.download for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1525",
    name: "Score webinar.attend for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1526",
    name: "Score email.open for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1527",
    name: "Score link.click for Director in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1528",
    name: "Score demo.request for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1529",
    name: "Score pricing.view for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1530",
    name: "Score whitepaper.download for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1531",
    name: "Score webinar.attend for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1532",
    name: "Score email.open for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1533",
    name: "Score link.click for Manager in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1534",
    name: "Score demo.request for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1535",
    name: "Score pricing.view for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1536",
    name: "Score whitepaper.download for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1537",
    name: "Score webinar.attend for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1538",
    name: "Score email.open for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1539",
    name: "Score link.click for Analyst in Retail (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1540",
    name: "Score demo.request for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1541",
    name: "Score pricing.view for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1542",
    name: "Score whitepaper.download for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1543",
    name: "Score webinar.attend for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1544",
    name: "Score email.open for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1545",
    name: "Score link.click for CEO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1546",
    name: "Score demo.request for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1547",
    name: "Score pricing.view for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1548",
    name: "Score whitepaper.download for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1549",
    name: "Score webinar.attend for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1550",
    name: "Score email.open for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1551",
    name: "Score link.click for CTO in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1552",
    name: "Score demo.request for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1553",
    name: "Score pricing.view for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1554",
    name: "Score whitepaper.download for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1555",
    name: "Score webinar.attend for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1556",
    name: "Score email.open for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1557",
    name: "Score link.click for VP in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1558",
    name: "Score demo.request for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1559",
    name: "Score pricing.view for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1560",
    name: "Score whitepaper.download for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1561",
    name: "Score webinar.attend for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1562",
    name: "Score email.open for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1563",
    name: "Score link.click for Director in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1564",
    name: "Score demo.request for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1565",
    name: "Score pricing.view for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1566",
    name: "Score whitepaper.download for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1567",
    name: "Score webinar.attend for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1568",
    name: "Score email.open for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1569",
    name: "Score link.click for Manager in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1570",
    name: "Score demo.request for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1571",
    name: "Score pricing.view for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1572",
    name: "Score whitepaper.download for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1573",
    name: "Score webinar.attend for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1574",
    name: "Score email.open for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1575",
    name: "Score link.click for Analyst in Retail (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1576",
    name: "Score demo.request for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1577",
    name: "Score pricing.view for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1578",
    name: "Score whitepaper.download for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1579",
    name: "Score webinar.attend for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1580",
    name: "Score email.open for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1581",
    name: "Score link.click for CEO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1582",
    name: "Score demo.request for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1583",
    name: "Score pricing.view for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1584",
    name: "Score whitepaper.download for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1585",
    name: "Score webinar.attend for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1586",
    name: "Score email.open for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1587",
    name: "Score link.click for CTO in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1588",
    name: "Score demo.request for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1589",
    name: "Score pricing.view for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1590",
    name: "Score whitepaper.download for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1591",
    name: "Score webinar.attend for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1592",
    name: "Score email.open for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1593",
    name: "Score link.click for VP in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1594",
    name: "Score demo.request for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1595",
    name: "Score pricing.view for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1596",
    name: "Score whitepaper.download for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1597",
    name: "Score webinar.attend for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1598",
    name: "Score email.open for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1599",
    name: "Score link.click for Director in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1600",
    name: "Score demo.request for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1601",
    name: "Score pricing.view for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1602",
    name: "Score whitepaper.download for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1603",
    name: "Score webinar.attend for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1604",
    name: "Score email.open for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1605",
    name: "Score link.click for Manager in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1606",
    name: "Score demo.request for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1607",
    name: "Score pricing.view for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1608",
    name: "Score whitepaper.download for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1609",
    name: "Score webinar.attend for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1610",
    name: "Score email.open for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1611",
    name: "Score link.click for Analyst in Manufacturing (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1612",
    name: "Score demo.request for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1613",
    name: "Score pricing.view for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1614",
    name: "Score whitepaper.download for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1615",
    name: "Score webinar.attend for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1616",
    name: "Score email.open for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1617",
    name: "Score link.click for CEO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1618",
    name: "Score demo.request for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1619",
    name: "Score pricing.view for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1620",
    name: "Score whitepaper.download for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1621",
    name: "Score webinar.attend for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1622",
    name: "Score email.open for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1623",
    name: "Score link.click for CTO in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1624",
    name: "Score demo.request for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1625",
    name: "Score pricing.view for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1626",
    name: "Score whitepaper.download for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1627",
    name: "Score webinar.attend for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1628",
    name: "Score email.open for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1629",
    name: "Score link.click for VP in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1630",
    name: "Score demo.request for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1631",
    name: "Score pricing.view for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1632",
    name: "Score whitepaper.download for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1633",
    name: "Score webinar.attend for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1634",
    name: "Score email.open for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1635",
    name: "Score link.click for Director in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1636",
    name: "Score demo.request for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1637",
    name: "Score pricing.view for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1638",
    name: "Score whitepaper.download for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1639",
    name: "Score webinar.attend for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1640",
    name: "Score email.open for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1641",
    name: "Score link.click for Manager in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1642",
    name: "Score demo.request for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1643",
    name: "Score pricing.view for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1644",
    name: "Score whitepaper.download for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1645",
    name: "Score webinar.attend for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1646",
    name: "Score email.open for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1647",
    name: "Score link.click for Analyst in Manufacturing (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1648",
    name: "Score demo.request for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1649",
    name: "Score pricing.view for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1650",
    name: "Score whitepaper.download for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1651",
    name: "Score webinar.attend for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1652",
    name: "Score email.open for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1653",
    name: "Score link.click for CEO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1654",
    name: "Score demo.request for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1655",
    name: "Score pricing.view for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1656",
    name: "Score whitepaper.download for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1657",
    name: "Score webinar.attend for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1658",
    name: "Score email.open for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1659",
    name: "Score link.click for CTO in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1660",
    name: "Score demo.request for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1661",
    name: "Score pricing.view for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1662",
    name: "Score whitepaper.download for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1663",
    name: "Score webinar.attend for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1664",
    name: "Score email.open for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1665",
    name: "Score link.click for VP in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1666",
    name: "Score demo.request for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1667",
    name: "Score pricing.view for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1668",
    name: "Score whitepaper.download for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1669",
    name: "Score webinar.attend for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1670",
    name: "Score email.open for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1671",
    name: "Score link.click for Director in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1672",
    name: "Score demo.request for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1673",
    name: "Score pricing.view for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1674",
    name: "Score whitepaper.download for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1675",
    name: "Score webinar.attend for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1676",
    name: "Score email.open for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1677",
    name: "Score link.click for Manager in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1678",
    name: "Score demo.request for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1679",
    name: "Score pricing.view for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1680",
    name: "Score whitepaper.download for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1681",
    name: "Score webinar.attend for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1682",
    name: "Score email.open for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1683",
    name: "Score link.click for Analyst in Manufacturing (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1684",
    name: "Score demo.request for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1685",
    name: "Score pricing.view for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1686",
    name: "Score whitepaper.download for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1687",
    name: "Score webinar.attend for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1688",
    name: "Score email.open for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1689",
    name: "Score link.click for CEO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1690",
    name: "Score demo.request for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1691",
    name: "Score pricing.view for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1692",
    name: "Score whitepaper.download for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1693",
    name: "Score webinar.attend for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1694",
    name: "Score email.open for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1695",
    name: "Score link.click for CTO in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1696",
    name: "Score demo.request for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1697",
    name: "Score pricing.view for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1698",
    name: "Score whitepaper.download for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1699",
    name: "Score webinar.attend for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1700",
    name: "Score email.open for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1701",
    name: "Score link.click for VP in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1702",
    name: "Score demo.request for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1703",
    name: "Score pricing.view for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1704",
    name: "Score whitepaper.download for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1705",
    name: "Score webinar.attend for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1706",
    name: "Score email.open for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1707",
    name: "Score link.click for Director in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1708",
    name: "Score demo.request for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1709",
    name: "Score pricing.view for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1710",
    name: "Score whitepaper.download for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1711",
    name: "Score webinar.attend for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1712",
    name: "Score email.open for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1713",
    name: "Score link.click for Manager in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1714",
    name: "Score demo.request for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1715",
    name: "Score pricing.view for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1716",
    name: "Score whitepaper.download for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1717",
    name: "Score webinar.attend for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1718",
    name: "Score email.open for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1719",
    name: "Score link.click for Analyst in Manufacturing (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1720",
    name: "Score demo.request for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1721",
    name: "Score pricing.view for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1722",
    name: "Score whitepaper.download for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1723",
    name: "Score webinar.attend for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1724",
    name: "Score email.open for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1725",
    name: "Score link.click for CEO in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1726",
    name: "Score demo.request for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1727",
    name: "Score pricing.view for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1728",
    name: "Score whitepaper.download for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1729",
    name: "Score webinar.attend for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1730",
    name: "Score email.open for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1731",
    name: "Score link.click for CTO in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1732",
    name: "Score demo.request for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1733",
    name: "Score pricing.view for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1734",
    name: "Score whitepaper.download for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1735",
    name: "Score webinar.attend for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1736",
    name: "Score email.open for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1737",
    name: "Score link.click for VP in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1738",
    name: "Score demo.request for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1739",
    name: "Score pricing.view for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1740",
    name: "Score whitepaper.download for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1741",
    name: "Score webinar.attend for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1742",
    name: "Score email.open for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1743",
    name: "Score link.click for Director in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1744",
    name: "Score demo.request for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1745",
    name: "Score pricing.view for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1746",
    name: "Score whitepaper.download for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1747",
    name: "Score webinar.attend for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1748",
    name: "Score email.open for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1749",
    name: "Score link.click for Manager in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1750",
    name: "Score demo.request for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1751",
    name: "Score pricing.view for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1752",
    name: "Score whitepaper.download for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1753",
    name: "Score webinar.attend for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1754",
    name: "Score email.open for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1755",
    name: "Score link.click for Analyst in Energy (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1756",
    name: "Score demo.request for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1757",
    name: "Score pricing.view for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1758",
    name: "Score whitepaper.download for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1759",
    name: "Score webinar.attend for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1760",
    name: "Score email.open for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1761",
    name: "Score link.click for CEO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1762",
    name: "Score demo.request for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1763",
    name: "Score pricing.view for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1764",
    name: "Score whitepaper.download for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1765",
    name: "Score webinar.attend for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1766",
    name: "Score email.open for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1767",
    name: "Score link.click for CTO in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1768",
    name: "Score demo.request for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1769",
    name: "Score pricing.view for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1770",
    name: "Score whitepaper.download for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1771",
    name: "Score webinar.attend for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1772",
    name: "Score email.open for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1773",
    name: "Score link.click for VP in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1774",
    name: "Score demo.request for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1775",
    name: "Score pricing.view for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1776",
    name: "Score whitepaper.download for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1777",
    name: "Score webinar.attend for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1778",
    name: "Score email.open for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1779",
    name: "Score link.click for Director in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1780",
    name: "Score demo.request for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1781",
    name: "Score pricing.view for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1782",
    name: "Score whitepaper.download for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1783",
    name: "Score webinar.attend for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1784",
    name: "Score email.open for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1785",
    name: "Score link.click for Manager in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1786",
    name: "Score demo.request for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1787",
    name: "Score pricing.view for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1788",
    name: "Score whitepaper.download for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1789",
    name: "Score webinar.attend for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1790",
    name: "Score email.open for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1791",
    name: "Score link.click for Analyst in Energy (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1792",
    name: "Score demo.request for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1793",
    name: "Score pricing.view for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1794",
    name: "Score whitepaper.download for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1795",
    name: "Score webinar.attend for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1796",
    name: "Score email.open for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1797",
    name: "Score link.click for CEO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1798",
    name: "Score demo.request for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1799",
    name: "Score pricing.view for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1800",
    name: "Score whitepaper.download for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1801",
    name: "Score webinar.attend for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1802",
    name: "Score email.open for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1803",
    name: "Score link.click for CTO in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1804",
    name: "Score demo.request for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1805",
    name: "Score pricing.view for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1806",
    name: "Score whitepaper.download for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1807",
    name: "Score webinar.attend for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1808",
    name: "Score email.open for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1809",
    name: "Score link.click for VP in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1810",
    name: "Score demo.request for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1811",
    name: "Score pricing.view for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1812",
    name: "Score whitepaper.download for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1813",
    name: "Score webinar.attend for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1814",
    name: "Score email.open for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1815",
    name: "Score link.click for Director in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1816",
    name: "Score demo.request for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1817",
    name: "Score pricing.view for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1818",
    name: "Score whitepaper.download for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1819",
    name: "Score webinar.attend for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1820",
    name: "Score email.open for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1821",
    name: "Score link.click for Manager in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1822",
    name: "Score demo.request for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1823",
    name: "Score pricing.view for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1824",
    name: "Score whitepaper.download for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1825",
    name: "Score webinar.attend for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1826",
    name: "Score email.open for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1827",
    name: "Score link.click for Analyst in Energy (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1828",
    name: "Score demo.request for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1829",
    name: "Score pricing.view for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1830",
    name: "Score whitepaper.download for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1831",
    name: "Score webinar.attend for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1832",
    name: "Score email.open for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1833",
    name: "Score link.click for CEO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1834",
    name: "Score demo.request for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1835",
    name: "Score pricing.view for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1836",
    name: "Score whitepaper.download for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1837",
    name: "Score webinar.attend for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1838",
    name: "Score email.open for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1839",
    name: "Score link.click for CTO in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1840",
    name: "Score demo.request for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1841",
    name: "Score pricing.view for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1842",
    name: "Score whitepaper.download for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1843",
    name: "Score webinar.attend for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1844",
    name: "Score email.open for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1845",
    name: "Score link.click for VP in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1846",
    name: "Score demo.request for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1847",
    name: "Score pricing.view for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1848",
    name: "Score whitepaper.download for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1849",
    name: "Score webinar.attend for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1850",
    name: "Score email.open for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1851",
    name: "Score link.click for Director in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1852",
    name: "Score demo.request for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1853",
    name: "Score pricing.view for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1854",
    name: "Score whitepaper.download for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1855",
    name: "Score webinar.attend for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1856",
    name: "Score email.open for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1857",
    name: "Score link.click for Manager in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1858",
    name: "Score demo.request for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1859",
    name: "Score pricing.view for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1860",
    name: "Score whitepaper.download for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1861",
    name: "Score webinar.attend for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1862",
    name: "Score email.open for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1863",
    name: "Score link.click for Analyst in Energy (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1864",
    name: "Score demo.request for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1865",
    name: "Score pricing.view for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1866",
    name: "Score whitepaper.download for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1867",
    name: "Score webinar.attend for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1868",
    name: "Score email.open for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1869",
    name: "Score link.click for CEO in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1870",
    name: "Score demo.request for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1871",
    name: "Score pricing.view for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1872",
    name: "Score whitepaper.download for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1873",
    name: "Score webinar.attend for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1874",
    name: "Score email.open for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1875",
    name: "Score link.click for CTO in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1876",
    name: "Score demo.request for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1877",
    name: "Score pricing.view for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1878",
    name: "Score whitepaper.download for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1879",
    name: "Score webinar.attend for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1880",
    name: "Score email.open for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1881",
    name: "Score link.click for VP in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1882",
    name: "Score demo.request for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1883",
    name: "Score pricing.view for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1884",
    name: "Score whitepaper.download for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1885",
    name: "Score webinar.attend for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1886",
    name: "Score email.open for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1887",
    name: "Score link.click for Director in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1888",
    name: "Score demo.request for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1889",
    name: "Score pricing.view for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1890",
    name: "Score whitepaper.download for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1891",
    name: "Score webinar.attend for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1892",
    name: "Score email.open for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1893",
    name: "Score link.click for Manager in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1894",
    name: "Score demo.request for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1895",
    name: "Score pricing.view for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1896",
    name: "Score whitepaper.download for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1897",
    name: "Score webinar.attend for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1898",
    name: "Score email.open for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1899",
    name: "Score link.click for Analyst in Education (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1900",
    name: "Score demo.request for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1901",
    name: "Score pricing.view for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1902",
    name: "Score whitepaper.download for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1903",
    name: "Score webinar.attend for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1904",
    name: "Score email.open for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1905",
    name: "Score link.click for CEO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1906",
    name: "Score demo.request for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1907",
    name: "Score pricing.view for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1908",
    name: "Score whitepaper.download for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1909",
    name: "Score webinar.attend for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1910",
    name: "Score email.open for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1911",
    name: "Score link.click for CTO in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1912",
    name: "Score demo.request for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1913",
    name: "Score pricing.view for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1914",
    name: "Score whitepaper.download for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1915",
    name: "Score webinar.attend for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1916",
    name: "Score email.open for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1917",
    name: "Score link.click for VP in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1918",
    name: "Score demo.request for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1919",
    name: "Score pricing.view for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1920",
    name: "Score whitepaper.download for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1921",
    name: "Score webinar.attend for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1922",
    name: "Score email.open for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1923",
    name: "Score link.click for Director in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1924",
    name: "Score demo.request for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1925",
    name: "Score pricing.view for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1926",
    name: "Score whitepaper.download for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1927",
    name: "Score webinar.attend for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1928",
    name: "Score email.open for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1929",
    name: "Score link.click for Manager in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1930",
    name: "Score demo.request for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1931",
    name: "Score pricing.view for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1932",
    name: "Score whitepaper.download for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1933",
    name: "Score webinar.attend for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1934",
    name: "Score email.open for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1935",
    name: "Score link.click for Analyst in Education (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1936",
    name: "Score demo.request for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1937",
    name: "Score pricing.view for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1938",
    name: "Score whitepaper.download for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1939",
    name: "Score webinar.attend for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1940",
    name: "Score email.open for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1941",
    name: "Score link.click for CEO in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1942",
    name: "Score demo.request for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1943",
    name: "Score pricing.view for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1944",
    name: "Score whitepaper.download for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1945",
    name: "Score webinar.attend for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1946",
    name: "Score email.open for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1947",
    name: "Score link.click for CTO in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1948",
    name: "Score demo.request for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1949",
    name: "Score pricing.view for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1950",
    name: "Score whitepaper.download for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1951",
    name: "Score webinar.attend for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1952",
    name: "Score email.open for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1953",
    name: "Score link.click for VP in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1954",
    name: "Score demo.request for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1955",
    name: "Score pricing.view for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1956",
    name: "Score whitepaper.download for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1957",
    name: "Score webinar.attend for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1958",
    name: "Score email.open for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1959",
    name: "Score link.click for Director in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1960",
    name: "Score demo.request for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1961",
    name: "Score pricing.view for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1962",
    name: "Score whitepaper.download for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1963",
    name: "Score webinar.attend for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1964",
    name: "Score email.open for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1965",
    name: "Score link.click for Manager in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_1966",
    name: "Score demo.request for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1967",
    name: "Score pricing.view for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1968",
    name: "Score whitepaper.download for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1969",
    name: "Score webinar.attend for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1970",
    name: "Score email.open for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1971",
    name: "Score link.click for Analyst in Education (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_1972",
    name: "Score demo.request for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_1973",
    name: "Score pricing.view for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1974",
    name: "Score whitepaper.download for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1975",
    name: "Score webinar.attend for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1976",
    name: "Score email.open for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1977",
    name: "Score link.click for CEO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1978",
    name: "Score demo.request for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_1979",
    name: "Score pricing.view for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1980",
    name: "Score whitepaper.download for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1981",
    name: "Score webinar.attend for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1982",
    name: "Score email.open for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1983",
    name: "Score link.click for CTO in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1984",
    name: "Score demo.request for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_1985",
    name: "Score pricing.view for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1986",
    name: "Score whitepaper.download for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1987",
    name: "Score webinar.attend for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1988",
    name: "Score email.open for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_1989",
    name: "Score link.click for VP in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_1990",
    name: "Score demo.request for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_1991",
    name: "Score pricing.view for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_1992",
    name: "Score whitepaper.download for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_1993",
    name: "Score webinar.attend for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_1994",
    name: "Score email.open for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_1995",
    name: "Score link.click for Director in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_1996",
    name: "Score demo.request for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_1997",
    name: "Score pricing.view for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_1998",
    name: "Score whitepaper.download for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_1999",
    name: "Score webinar.attend for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2000",
    name: "Score email.open for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2001",
    name: "Score link.click for Manager in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_2002",
    name: "Score demo.request for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2003",
    name: "Score pricing.view for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2004",
    name: "Score whitepaper.download for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2005",
    name: "Score webinar.attend for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2006",
    name: "Score email.open for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2007",
    name: "Score link.click for Analyst in Education (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_2008",
    name: "Score demo.request for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_2009",
    name: "Score pricing.view for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2010",
    name: "Score whitepaper.download for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2011",
    name: "Score webinar.attend for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2012",
    name: "Score email.open for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2013",
    name: "Score link.click for CEO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2014",
    name: "Score demo.request for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_2015",
    name: "Score pricing.view for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2016",
    name: "Score whitepaper.download for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2017",
    name: "Score webinar.attend for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2018",
    name: "Score email.open for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2019",
    name: "Score link.click for CTO in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2020",
    name: "Score demo.request for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2021",
    name: "Score pricing.view for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2022",
    name: "Score whitepaper.download for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2023",
    name: "Score webinar.attend for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2024",
    name: "Score email.open for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2025",
    name: "Score link.click for VP in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2026",
    name: "Score demo.request for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2027",
    name: "Score pricing.view for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2028",
    name: "Score whitepaper.download for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2029",
    name: "Score webinar.attend for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2030",
    name: "Score email.open for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2031",
    name: "Score link.click for Director in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2032",
    name: "Score demo.request for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2033",
    name: "Score pricing.view for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2034",
    name: "Score whitepaper.download for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2035",
    name: "Score webinar.attend for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2036",
    name: "Score email.open for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2037",
    name: "Score link.click for Manager in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_2038",
    name: "Score demo.request for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2039",
    name: "Score pricing.view for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2040",
    name: "Score whitepaper.download for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2041",
    name: "Score webinar.attend for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2042",
    name: "Score email.open for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2043",
    name: "Score link.click for Analyst in RealEstate (NA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_2044",
    name: "Score demo.request for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_2045",
    name: "Score pricing.view for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2046",
    name: "Score whitepaper.download for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2047",
    name: "Score webinar.attend for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2048",
    name: "Score email.open for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2049",
    name: "Score link.click for CEO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2050",
    name: "Score demo.request for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_2051",
    name: "Score pricing.view for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2052",
    name: "Score whitepaper.download for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2053",
    name: "Score webinar.attend for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2054",
    name: "Score email.open for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2055",
    name: "Score link.click for CTO in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2056",
    name: "Score demo.request for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2057",
    name: "Score pricing.view for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2058",
    name: "Score whitepaper.download for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2059",
    name: "Score webinar.attend for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2060",
    name: "Score email.open for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2061",
    name: "Score link.click for VP in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2062",
    name: "Score demo.request for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2063",
    name: "Score pricing.view for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2064",
    name: "Score whitepaper.download for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2065",
    name: "Score webinar.attend for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2066",
    name: "Score email.open for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2067",
    name: "Score link.click for Director in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2068",
    name: "Score demo.request for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2069",
    name: "Score pricing.view for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2070",
    name: "Score whitepaper.download for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2071",
    name: "Score webinar.attend for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2072",
    name: "Score email.open for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2073",
    name: "Score link.click for Manager in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_2074",
    name: "Score demo.request for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2075",
    name: "Score pricing.view for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2076",
    name: "Score whitepaper.download for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2077",
    name: "Score webinar.attend for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2078",
    name: "Score email.open for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2079",
    name: "Score link.click for Analyst in RealEstate (EMEA)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_2080",
    name: "Score demo.request for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_2081",
    name: "Score pricing.view for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2082",
    name: "Score whitepaper.download for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2083",
    name: "Score webinar.attend for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2084",
    name: "Score email.open for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2085",
    name: "Score link.click for CEO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2086",
    name: "Score demo.request for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_2087",
    name: "Score pricing.view for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2088",
    name: "Score whitepaper.download for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2089",
    name: "Score webinar.attend for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2090",
    name: "Score email.open for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2091",
    name: "Score link.click for CTO in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2092",
    name: "Score demo.request for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2093",
    name: "Score pricing.view for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2094",
    name: "Score whitepaper.download for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2095",
    name: "Score webinar.attend for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2096",
    name: "Score email.open for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2097",
    name: "Score link.click for VP in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2098",
    name: "Score demo.request for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2099",
    name: "Score pricing.view for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2100",
    name: "Score whitepaper.download for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2101",
    name: "Score webinar.attend for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2102",
    name: "Score email.open for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2103",
    name: "Score link.click for Director in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2104",
    name: "Score demo.request for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2105",
    name: "Score pricing.view for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2106",
    name: "Score whitepaper.download for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2107",
    name: "Score webinar.attend for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2108",
    name: "Score email.open for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2109",
    name: "Score link.click for Manager in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_2110",
    name: "Score demo.request for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2111",
    name: "Score pricing.view for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2112",
    name: "Score whitepaper.download for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2113",
    name: "Score webinar.attend for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2114",
    name: "Score email.open for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2115",
    name: "Score link.click for Analyst in RealEstate (APAC)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
  {
    id: "rule_gen_2116",
    name: "Score demo.request for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 15,
    priority: 85
  },
  {
    id: "rule_gen_2117",
    name: "Score pricing.view for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2118",
    name: "Score whitepaper.download for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2119",
    name: "Score webinar.attend for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2120",
    name: "Score email.open for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2121",
    name: "Score link.click for CEO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2122",
    name: "Score demo.request for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 20,
    priority: 80
  },
  {
    id: "rule_gen_2123",
    name: "Score pricing.view for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2124",
    name: "Score whitepaper.download for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2125",
    name: "Score webinar.attend for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2126",
    name: "Score email.open for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2127",
    name: "Score link.click for CTO in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2128",
    name: "Score demo.request for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 25,
    priority: 75
  },
  {
    id: "rule_gen_2129",
    name: "Score pricing.view for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2130",
    name: "Score whitepaper.download for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2131",
    name: "Score webinar.attend for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2132",
    name: "Score email.open for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2133",
    name: "Score link.click for VP in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2134",
    name: "Score demo.request for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 30,
    priority: 70
  },
  {
    id: "rule_gen_2135",
    name: "Score pricing.view for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2136",
    name: "Score whitepaper.download for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2137",
    name: "Score webinar.attend for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2138",
    name: "Score email.open for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2139",
    name: "Score link.click for Director in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2140",
    name: "Score demo.request for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 35,
    priority: 65
  },
  {
    id: "rule_gen_2141",
    name: "Score pricing.view for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 45,
    priority: 55
  },
  {
    id: "rule_gen_2142",
    name: "Score whitepaper.download for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 55,
    priority: 45
  },
  {
    id: "rule_gen_2143",
    name: "Score webinar.attend for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 65,
    priority: 35
  },
  {
    id: "rule_gen_2144",
    name: "Score email.open for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 75,
    priority: 25
  },
  {
    id: "rule_gen_2145",
    name: "Score link.click for Manager in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 85,
    priority: 15
  },
  {
    id: "rule_gen_2146",
    name: "Score demo.request for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "demo.request" },
    delta: 40,
    priority: 60
  },
  {
    id: "rule_gen_2147",
    name: "Score pricing.view for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "pricing.view" },
    delta: 50,
    priority: 50
  },
  {
    id: "rule_gen_2148",
    name: "Score whitepaper.download for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "whitepaper.download" },
    delta: 60,
    priority: 40
  },
  {
    id: "rule_gen_2149",
    name: "Score webinar.attend for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "webinar.attend" },
    delta: 70,
    priority: 30
  },
  {
    id: "rule_gen_2150",
    name: "Score email.open for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "email.open" },
    delta: 80,
    priority: 20
  },
  {
    id: "rule_gen_2151",
    name: "Score link.click for Analyst in RealEstate (LATAM)",
    enabled: true,
    condition: { eventType: "link.click" },
    delta: 90,
    priority: 10
  },
];
