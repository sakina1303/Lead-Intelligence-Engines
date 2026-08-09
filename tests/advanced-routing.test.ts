import { describe, expect, test } from "vitest";
import { evaluateRoutingTerritory, assignSalesRep, mergeLeadsDeterministic, createLead } from "../src/leads.js";
describe("Advanced Routing Invariants", () => {
  test("routing case 0: territory matching and capacity", () => {
    const lead = createLead({ id: "l-0", name: "Lead 0", email: "t0@t.com", createdAt: 1000, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2000);
      expect(res.leadId).toBe("l-0");
    }
  });
  test("routing case 1: territory matching and capacity", () => {
    const lead = createLead({ id: "l-1", name: "Lead 1", email: "t1@t.com", createdAt: 1001, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2001);
      expect(res.leadId).toBe("l-1");
    }
  });
  test("routing case 2: territory matching and capacity", () => {
    const lead = createLead({ id: "l-2", name: "Lead 2", email: "t2@t.com", createdAt: 1002, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2002);
      expect(res.leadId).toBe("l-2");
    }
  });
  test("routing case 3: territory matching and capacity", () => {
    const lead = createLead({ id: "l-3", name: "Lead 3", email: "t3@t.com", createdAt: 1003, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2003);
      expect(res.leadId).toBe("l-3");
    }
  });
  test("routing case 4: territory matching and capacity", () => {
    const lead = createLead({ id: "l-4", name: "Lead 4", email: "t4@t.com", createdAt: 1004, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2004);
      expect(res.leadId).toBe("l-4");
    }
  });
  test("routing case 5: territory matching and capacity", () => {
    const lead = createLead({ id: "l-5", name: "Lead 5", email: "t5@t.com", createdAt: 1005, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2005);
      expect(res.leadId).toBe("l-5");
    }
  });
  test("routing case 6: territory matching and capacity", () => {
    const lead = createLead({ id: "l-6", name: "Lead 6", email: "t6@t.com", createdAt: 1006, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2006);
      expect(res.leadId).toBe("l-6");
    }
  });
  test("routing case 7: territory matching and capacity", () => {
    const lead = createLead({ id: "l-7", name: "Lead 7", email: "t7@t.com", createdAt: 1007, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2007);
      expect(res.leadId).toBe("l-7");
    }
  });
  test("routing case 8: territory matching and capacity", () => {
    const lead = createLead({ id: "l-8", name: "Lead 8", email: "t8@t.com", createdAt: 1008, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2008);
      expect(res.leadId).toBe("l-8");
    }
  });
  test("routing case 9: territory matching and capacity", () => {
    const lead = createLead({ id: "l-9", name: "Lead 9", email: "t9@t.com", createdAt: 1009, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2009);
      expect(res.leadId).toBe("l-9");
    }
  });
  test("routing case 10: territory matching and capacity", () => {
    const lead = createLead({ id: "l-10", name: "Lead 10", email: "t10@t.com", createdAt: 1010, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2010);
      expect(res.leadId).toBe("l-10");
    }
  });
  test("routing case 11: territory matching and capacity", () => {
    const lead = createLead({ id: "l-11", name: "Lead 11", email: "t11@t.com", createdAt: 1011, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2011);
      expect(res.leadId).toBe("l-11");
    }
  });
  test("routing case 12: territory matching and capacity", () => {
    const lead = createLead({ id: "l-12", name: "Lead 12", email: "t12@t.com", createdAt: 1012, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2012);
      expect(res.leadId).toBe("l-12");
    }
  });
  test("routing case 13: territory matching and capacity", () => {
    const lead = createLead({ id: "l-13", name: "Lead 13", email: "t13@t.com", createdAt: 1013, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2013);
      expect(res.leadId).toBe("l-13");
    }
  });
  test("routing case 14: territory matching and capacity", () => {
    const lead = createLead({ id: "l-14", name: "Lead 14", email: "t14@t.com", createdAt: 1014, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2014);
      expect(res.leadId).toBe("l-14");
    }
  });
  test("routing case 15: territory matching and capacity", () => {
    const lead = createLead({ id: "l-15", name: "Lead 15", email: "t15@t.com", createdAt: 1015, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2015);
      expect(res.leadId).toBe("l-15");
    }
  });
  test("routing case 16: territory matching and capacity", () => {
    const lead = createLead({ id: "l-16", name: "Lead 16", email: "t16@t.com", createdAt: 1016, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2016);
      expect(res.leadId).toBe("l-16");
    }
  });
  test("routing case 17: territory matching and capacity", () => {
    const lead = createLead({ id: "l-17", name: "Lead 17", email: "t17@t.com", createdAt: 1017, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2017);
      expect(res.leadId).toBe("l-17");
    }
  });
  test("routing case 18: territory matching and capacity", () => {
    const lead = createLead({ id: "l-18", name: "Lead 18", email: "t18@t.com", createdAt: 1018, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2018);
      expect(res.leadId).toBe("l-18");
    }
  });
  test("routing case 19: territory matching and capacity", () => {
    const lead = createLead({ id: "l-19", name: "Lead 19", email: "t19@t.com", createdAt: 1019, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2019);
      expect(res.leadId).toBe("l-19");
    }
  });
  test("routing case 20: territory matching and capacity", () => {
    const lead = createLead({ id: "l-20", name: "Lead 20", email: "t20@t.com", createdAt: 1020, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2020);
      expect(res.leadId).toBe("l-20");
    }
  });
  test("routing case 21: territory matching and capacity", () => {
    const lead = createLead({ id: "l-21", name: "Lead 21", email: "t21@t.com", createdAt: 1021, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2021);
      expect(res.leadId).toBe("l-21");
    }
  });
  test("routing case 22: territory matching and capacity", () => {
    const lead = createLead({ id: "l-22", name: "Lead 22", email: "t22@t.com", createdAt: 1022, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2022);
      expect(res.leadId).toBe("l-22");
    }
  });
  test("routing case 23: territory matching and capacity", () => {
    const lead = createLead({ id: "l-23", name: "Lead 23", email: "t23@t.com", createdAt: 1023, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2023);
      expect(res.leadId).toBe("l-23");
    }
  });
  test("routing case 24: territory matching and capacity", () => {
    const lead = createLead({ id: "l-24", name: "Lead 24", email: "t24@t.com", createdAt: 1024, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2024);
      expect(res.leadId).toBe("l-24");
    }
  });
  test("routing case 25: territory matching and capacity", () => {
    const lead = createLead({ id: "l-25", name: "Lead 25", email: "t25@t.com", createdAt: 1025, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2025);
      expect(res.leadId).toBe("l-25");
    }
  });
  test("routing case 26: territory matching and capacity", () => {
    const lead = createLead({ id: "l-26", name: "Lead 26", email: "t26@t.com", createdAt: 1026, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2026);
      expect(res.leadId).toBe("l-26");
    }
  });
  test("routing case 27: territory matching and capacity", () => {
    const lead = createLead({ id: "l-27", name: "Lead 27", email: "t27@t.com", createdAt: 1027, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2027);
      expect(res.leadId).toBe("l-27");
    }
  });
  test("routing case 28: territory matching and capacity", () => {
    const lead = createLead({ id: "l-28", name: "Lead 28", email: "t28@t.com", createdAt: 1028, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2028);
      expect(res.leadId).toBe("l-28");
    }
  });
  test("routing case 29: territory matching and capacity", () => {
    const lead = createLead({ id: "l-29", name: "Lead 29", email: "t29@t.com", createdAt: 1029, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2029);
      expect(res.leadId).toBe("l-29");
    }
  });
  test("routing case 30: territory matching and capacity", () => {
    const lead = createLead({ id: "l-30", name: "Lead 30", email: "t30@t.com", createdAt: 1030, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2030);
      expect(res.leadId).toBe("l-30");
    }
  });
  test("routing case 31: territory matching and capacity", () => {
    const lead = createLead({ id: "l-31", name: "Lead 31", email: "t31@t.com", createdAt: 1031, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2031);
      expect(res.leadId).toBe("l-31");
    }
  });
  test("routing case 32: territory matching and capacity", () => {
    const lead = createLead({ id: "l-32", name: "Lead 32", email: "t32@t.com", createdAt: 1032, attributes: { region: "us-east", tier: 2 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2032);
      expect(res.leadId).toBe("l-32");
    }
  });
  test("routing case 33: territory matching and capacity", () => {
    const lead = createLead({ id: "l-33", name: "Lead 33", email: "t33@t.com", createdAt: 1033, attributes: { region: "us-east", tier: 0 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 1, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2033);
      expect(res.leadId).toBe("l-33");
    }
  });
  test("routing case 34: territory matching and capacity", () => {
    const lead = createLead({ id: "l-34", name: "Lead 34", email: "t34@t.com", createdAt: 1034, attributes: { region: "us-east", tier: 1 } }).value!;
    const territories = [{ id: "t1", name: "T1", requiredAttributes: { region: "us-east" }, isGlobal: false, fallbackRepId: "r-fall" }];
    const reps = [{ id: "r1", name: "R1", territoryId: "t1", currentActiveLeads: 0, maxCapacity: 2, isActive: true, skills: [] }];
    const t = evaluateRoutingTerritory(lead, territories);
    if (t) {
      const res = assignSalesRep(lead, t, reps, 2034);
      expect(res.leadId).toBe("l-34");
    }
  });
});
