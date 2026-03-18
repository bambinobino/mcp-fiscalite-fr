#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const OPENFISCA_API_BASE = "https://api.openfisca.org/latest";

class FrenchTaxServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "mcp-fiscalite-fr",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_tax_parameters",
          description: "Rechercher des paramètres fiscaux (ex: tranches d'impôts, SMIC, prime d'activité). Alimenté par OpenFisca.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Terme de recherche (ex: 'impot sur le revenu', 'salaire minimum', 'prime d\'activite')",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "simulate_income_tax",
          description: "Calculer une estimation de l'impôt sur le revenu (IR) français pour un cas simple (Individu seul). Alimenté par OpenFisca.",
          inputSchema: {
            type: "object",
            properties: {
              year: {
                type: "number",
                description: "Année fiscale (ex: 2023)",
              },
              income: {
                type: "number",
                description: "Revenu net annuel imposable en Euros",
              },
            },
            required: ["year", "income"],
          },
        },
        {
          name: "get_company_tax_info",
          description: "Rechercher des informations fiscales/administratives d'une entreprise via son numéro SIREN. Utilise l'API Sirene de l'INSEE.",
          inputSchema: {
            type: "object",
            properties: {
              siren: {
                type: "string",
                description: "Numéro SIREN (9 chiffres)",
              },
            },
            required: ["siren"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "search_tax_parameters":
            return await this.handleSearchTaxParameters(request.params.arguments);
          case "simulate_income_tax":
            return await this.handleSimulateIncomeTax(request.params.arguments);
          case "get_company_tax_info":
            return await this.handleGetCompanyTaxInfo(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          throw new McpError(ErrorCode.InvalidParams, error.message);
        }
        throw error;
      }
    });
  }

  private async handleSearchTaxParameters(args: any) {
    const { query } = z.object({ query: z.string() }).parse(args);
    try {
      // Note: OpenFisca API can be heavy. We fetch the parameter list.
      const response = await fetch(`${OPENFISCA_API_BASE}/france/parameters`);
      if (!response.ok) {
        throw new Error(`OpenFisca API error: ${response.statusText}`);
      }
      const data: any = await response.json();
      
      const results: any[] = [];
      const search = (obj: any, path: string = "") => {
        for (const key in obj) {
          const newPath = path ? `${path}.${key}` : key;
          const label = obj[key].description || obj[key].label || key;
          if (label.toLowerCase().includes(query.toLowerCase()) || key.toLowerCase().includes(query.toLowerCase())) {
             results.push({ 
               path: newPath, 
               description: label,
               values: obj[key].values ? Object.entries(obj[key].values).slice(0, 3) : "Tree structure"
             });
          }
          if (typeof obj[key] === "object" && obj[key] !== null && !obj[key].values && results.length < 50) {
            search(obj[key], newPath);
          }
        }
      };
      search(data);

      return {
        content: [
          {
            type: "text",
            text: results.length > 0 
              ? `Found ${results.length} parameters matching "${query}":\n\n${JSON.stringify(results.slice(0, 15), null, 2)}`
              : `No parameters found for "${query}".`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async handleSimulateIncomeTax(args: any) {
    const schema = z.object({
      year: z.number(),
      income: z.number(),
    });
    const { year, income } = schema.parse(args);
    
    try {
      // OpenFisca calculation for 1 person (Individu seul)
      const situation = {
        individus: {
          "Individu 1": {
            salaire_de_base: { [`${year}-01`]: income }, // OpenFisca usually uses monthly or annual depending on context, but let's try annual for simplicity in this case
          }
        },
        foyers_fiscaux: {
          "Foyer 1": {
            declarants: ["Individu 1"],
            impot_revenu_restant_a_payer: { [`${year}`]: null }
          }
        },
        menages: {
          "Menage 1": {
            personnes_a_charge: [],
            enfants: [],
            adultes: ["Individu 1"],
          }
        },
        familles: {
           "Famille 1": {
             adultes: ["Individu 1"]
           }
        }
      };

      const response = await fetch(`${OPENFISCA_API_BASE}/france/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`OpenFisca error: ${JSON.stringify(errorBody)}`);
      }

      const result = await response.json();
      const tax = result.foyers_fiscaux["Foyer 1"].impot_revenu_restant_a_payer[year];

      return {
        content: [
          {
            type: "text",
            text: `Simulation pour l'année ${year} avec un revenu de ${income}€ :\nImpôt sur le revenu estimé : ${Math.abs(tax).toFixed(2)}€`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error simulation: ${error.message}` }],
        isError: true,
      };
    }
  }

  private async handleGetCompanyTaxInfo(args: any) {
    const { siren } = z.object({ siren: z.string().length(9) }).parse(args);
    try {
      // Use public Sirene API (OpenData)
      const response = await fetch(`https://api.pme.gouv.fr/api/sirene/v3/unites_legales/${siren}`);
      if (!response.ok) {
         // Fallback to another public proxy if pme.gouv.fr is down or needs auth
         const fallback = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}`);
         if (!fallback.ok) throw new Error(`Could not find company with SIREN ${siren}`);
         const data = await fallback.json();
         return {
           content: [{ type: "text", text: JSON.stringify(data.results[0], null, 2) }]
         };
      }
      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error fetching company info: ${error.message}` }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP-Fiscalite-FR server running on stdio");
  }
}

const server = new FrenchTaxServer();
server.run().catch((error) => {
  console.error("Fatal error in server:", error);
  process.exit(1);
});
