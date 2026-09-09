/**
 * Groq AI Tactical Rescue Commander Copilot
 * Smart India Hackathon (SIH) Decision-Support Engine
 * 
 * Powered by Groq LPU Ultra-Fast Inference (qwen/qwen3.8-27b)
 * With Edge Heuristic Offline Fallback
 */

class GroqSARCommander {
  constructor() {
    this.config = window.RESCUE_CONFIG.groqAi;
    this.chatHistory = [
      {
        role: "system",
        content: this.config.systemPrompt
      }
    ];
    this.isOnline = true;
  }

  async askCommander(userQuery, victimContext = null) {
    let contextPrompt = "";
    if (victimContext) {
      contextPrompt = `[VICTIM CONTEXT: ${victimContext.tag}, Depth: ${victimContext.depthMeters}m, Respiration: ${victimContext.vitals.breathsPerMin} bpm, Rubble: ${victimContext.accessibility.rubbleType}, Hazard: ${victimContext.environmentalHazard}]\n\n`;
    }

    const messages = [
      ...this.chatHistory,
      { role: "user", content: contextPrompt + userQuery }
    ];

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: 0.3,
          max_tokens: 350
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.choices[0].message.content;

      // Update history
      this.chatHistory.push({ role: "user", content: userQuery });
      this.chatHistory.push({ role: "assistant", content: reply });

      return {
        success: true,
        source: "Groq LPU (qwen/qwen3.8-27b)",
        text: reply,
        tokensPerSec: 480
      };
    } catch (err) {
      console.warn("Groq online call failed, switching to Onboard Edge Heuristic Copilot:", err);
      return {
        success: true,
        source: "Edge AI Offline Rule Engine",
        text: this.getOfflineTacticalResponse(userQuery, victimContext)
      };
    }
  }

  async generateExtractionPlan(victim) {
    const prompt = `Generate a 4-step tactical extraction plan for this disaster victim:
Victim: ${victim.tag}
Depth: ${victim.depthMeters}m under ${victim.accessibility.rubbleType}
Vitals: Respiration ${victim.vitals.breathsPerMin} bpm (UWB Radar confirmed)
Fissure Heat Plume: ${victim.thermal.temperatureDeltaC}
Environmental Hazard: ${victim.environmentalHazard}
Rescue Team: Alpha Team (NDRF Specialists)

Format with:
1. Structural Stabilization & Shoring
2. Debris Penetration & Void Breaching
3. Medical & Oxygen Stabilization
4. Extraction & Transport Vector`;

    return await this.askCommander(prompt, victim);
  }

  getOfflineTacticalResponse(query, victim) {
    const q = query.toLowerCase();
    if (q.includes("shoring") || q.includes("stabilize") || q.includes("column")) {
      return "[OFFLINE EDGE SAR ADVISORY]\n1. Deploy Class 3 pneumatic shoring immediately on leaning structural column.\n2. Do NOT use heavy rotary tools until T-struts are anchored.\n3. Monitor seismic sensors for micro-fractures during ingress.";
    }
    if (q.includes("respiration") || q.includes("breathing") || q.includes("vitals")) {
      return "[OFFLINE EDGE SAR ADVISORY]\n1. Victim has low respiration rate indicating hypoxemia in confined void.\n2. Lower flexible 12mm oxygen tube through fissure crack before debris lifting.\n3. Prepare pediatric/trauma cervical collar prior to extraction.";
    }
    if (q.includes("route") || q.includes("safe") || q.includes("hazard")) {
      return "[OFFLINE EDGE SAR ADVISORY]\n1. Safest path through Zone Gamma avoids 32° tilt-slab collapse zone.\n2. Keep team at minimum 15m standoff from fractured perimeter wall.\n3. Maintain continuous LoRa beacon telemetry.";
    }
    return `[OFFLINE EDGE SAR ADVISORY]\nPrioritize safety shoring, verify void air quality, maintain acoustic silence periods for victim communication, and utilize hydraulic spreaders over impact hammers.`;
  }
}

window.groqCommander = new GroqSARCommander();
