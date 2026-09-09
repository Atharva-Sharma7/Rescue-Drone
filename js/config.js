/**
 * AI-Powered Quadcopter Search & Rescue System - Configuration & Scenario Data
 * Smart India Hackathon (SIH) Specification
 */

window.RESCUE_CONFIG = {
  mission: {
    title: "Project TRINETRA: AI-Powered Drone Search & Rescue System",
    subTitle: "SIH Disaster Response & Sub-Surface Victim Localization Platform",
    disasterType: "M7.2 Earthquake Structural Collapse & Landslide Zone",
    location: "Sector 9 Metro Corridor & Collapsed Commercial Complex",
    surveyArea: "120m x 120m Disaster Grid",
    weather: "Overcast, 28°C, Ambient Dust 84 µg/m³, Wind 6 km/h NW",
    status: "ACTIVE SEARCH & RESCUE MISSION"
  },

  groqAi: {
    apiKey: "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",
    model: "qwen/qwen3.8-27b",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    systemPrompt: "You are the AI Tactical SAR Commander Assistant for Project TRINETRA, an AI-powered quadcopter drone search and rescue system designed for the Smart India Hackathon (SIH). You assist NDRF/SDRF rescue commanders in disaster zones (earthquakes, collapsed buildings, landslides). Provide concise, authoritative, tactical advice on victim extraction, shoring, sensor fusion (UWB radar, crack-thermal, SDR sniffing, LiDAR), risk mitigation, and path planning. Keep recommendations actionable, prioritize human life, and respect realistic physical limitations."
  },

  quadcopterTelemetry: {
    droneModel: "AeroScan X8-Heavy Quadcopter (SAR Custom)",
    flightMode: "Precision Autonomous Hover Scan (LiDAR + UWB Locked)",
    altitude: 12.4, // meters AGL
    batteryLevel: 74, // percentage
    batteryRemainingTime: "23m 40s",
    groundSpeed: 1.2, // m/s during slow scan
    gpsFix: "RTK Fixed (32 Satellites, ±1.5cm accuracy)",
    heading: "142° SE",
    pitch: "-1.8°",
    roll: "+0.4°",
    loraMeshStatus: "Connected (4 Ground Nodes Active)",
    edgeCompute: {
      hardware: "NVIDIA Jetson Orin Nano (Local Edge AI)",
      tensorRTRuntime: "ONNX / TensorRT 8.6 INT8 Engine",
      inferenceFPS: 28.4,
      latencyMs: 34.2,
      offlineMode: true,
      dataSyncStatus: "Local Edge Storage (Zero Cloud Dependency)"
    },
    sensorPayload: {
      lidar: "Solid-State 3D LiDAR (300,000 pts/sec, 120m range)",
      radar: "Dual 60-64 GHz mmWave + 3.1-4.8 GHz UWB Radar Array",
      thermal: "LWIR High-Sensitivity Fissure Thermal Camera (640x512, NETD < 30mK)",
      rgb: "4K 60FPS Optical Zoom Gimbal Camera with Night Low-Light NIR",
      sdr: "Software Defined Radio (70 MHz - 6 GHz) + Directional Antenna Array",
      comms: "Long-Range 868MHz LoRa Mesh + Wi-Fi 6 Direct Link"
    }
  },

  groundTeam: {
    id: "RESCUE_ALPHA_TEAM",
    commander: "Captain R. Sharma (NDRF Specialist)",
    currentLocation: { x: -48, y: 0.8, z: 46 }, // Local 3D coordinate
    personnelCount: 5,
    equipment: ["Hydraulic Cutters", "Pneumatic Shoring", "Acoustic Listeners", "Portable Oxygen"],
    loraSignalDbm: -62,
    batteryLoRa: 91
  },

  statsOverview: {
    totalReportedMissing: 18,
    confirmedLocalizedSurvivors: 5,
    scanningGridSectors: 12,
    detectionBreakdown: {
      phoneAndHeartbeat: 2,
      phoneAndBreathing: 1,
      phoneOnly: 1,
      radarBreathingOnly: 1,
      pendingScan: 13
    }
  },

  victims: [
    {
      id: "VIC-01",
      tag: "Survivor #1 (Basement Cavity)",
      detectionType: "PHONE_HEARTBEAT_BREATHING",
      detectionBadge: "Phone + Breathing + Heartbeat Detected",
      badgeColor: "#16a34a",
      coords: { x: -14, y: -2.3, z: -10 },
      surfaceCoords: { x: -14, y: 1.2, z: -10 },
      depthMeters: 2.3,
      priorityLevel: "CRITICAL",
      calculatedScore: 94.2,
      vitals: {
        respirationDetected: true,
        breathsPerMin: 14,
        cardiacMotionDetected: true,
        heartRateBpm: 88,
        motionConfidence: "96% (Periodic Thoracic Micro-Doppler)",
        radarSNR: "+19.2 dB"
      },
      thermal: {
        fissurePlumeDetected: true,
        temperatureDeltaC: "+2.4°C above surface",
        ventType: "Shear crack fissure (Width: 4.2cm)"
      },
      digitalRescue: {
        sdrDeviceDetected: true,
        deviceName: "Samsung Galaxy S23 (Active Wi-Fi Probe)",
        macPrefix: "Samsung Mobile Exynos",
        rssiDbm: -68,
        protocol: "Wi-Fi Probe Request & BLE Sync",
        emRadiationSignature: "50Hz Wearable Clock Detected"
      },
      accessibility: {
        rubbleType: "Reinforced Concrete Beams & Slabs",
        extractionDifficulty: "Difficult",
        estimatedTimeMinutes: 45,
        requiredEquipment: ["Hydraulic Cutters", "Pneumatic Shoring", "Diamond Saw"]
      },
      environmentalHazard: "Moderate - Leaning column 2.8m north",
      recommendationSummary: "Full multi-sensor corroboration. Respiration steady (14 bpm) and heartbeat locked (88 bpm). Immediate shoring and hydraulic entry."
    },
    {
      id: "VIC-02",
      tag: "Survivor #2 (Collapsed Storefront)",
      detectionType: "PHONE_ONLY",
      detectionBadge: "Smartphone RF Sniffed (UWB Scanning In Progress)",
      badgeColor: "#0284c7",
      coords: { x: 22, y: -1.1, z: 18 },
      surfaceCoords: { x: 22, y: 0.9, z: 18 },
      depthMeters: 1.1,
      priorityLevel: "HIGH",
      calculatedScore: 81.5,
      vitals: {
        respirationDetected: false,
        breathsPerMin: null,
        cardiacMotionDetected: false,
        heartRateBpm: null,
        motionConfidence: "Awaiting close hover scan",
        radarSNR: "Scanning angle acquiring..."
      },
      thermal: {
        fissurePlumeDetected: true,
        temperatureDeltaC: "+1.3°C above surface",
        ventType: "Porous brick gaps"
      },
      digitalRescue: {
        sdrDeviceDetected: true,
        deviceName: "Apple iPhone 14 (Active BLE Beaconing)",
        macPrefix: "Apple Device (Find My Network)",
        rssiDbm: -72,
        protocol: "Periodic Bluetooth LE Advertisement",
        emRadiationSignature: "Active RF packet burst"
      },
      accessibility: {
        rubbleType: "Brick Masonry & Gypsum Debris",
        extractionDifficulty: "Moderate",
        estimatedTimeMinutes: 20,
        requiredEquipment: ["Manual Debris Rakes", "Hand Saws", "Stretcher"]
      },
      environmentalHazard: "Low - Ground level perimeter",
      recommendationSummary: "Smartphone actively transmitting beacon frames. Drone repositioned overhead for localized UWB radar respiration lock."
    },
    {
      id: "VIC-03",
      tag: "Survivor #3 (Walkway Rubble Void)",
      detectionType: "PHONE_BREATHING",
      detectionBadge: "Phone + UWB Breathing Detected",
      badgeColor: "#059669",
      coords: { x: -32, y: -0.4, z: 24 },
      surfaceCoords: { x: -32, y: 0.6, z: 24 },
      depthMeters: 0.4,
      priorityLevel: "HIGH",
      calculatedScore: 86.8,
      vitals: {
        respirationDetected: true,
        breathsPerMin: 18,
        cardiacMotionDetected: false,
        heartRateBpm: null,
        motionConfidence: "98% (High-amplitude chest wall displacement)",
        radarSNR: "+25.4 dB (Shallow depth)"
      },
      thermal: {
        fissurePlumeDetected: true,
        temperatureDeltaC: "+3.8°C (Direct cavity vent)",
        ventType: "Open rubble cavity"
      },
      digitalRescue: {
        sdrDeviceDetected: true,
        deviceName: "OnePlus 11 (Cellular Handshake Probe)",
        macPrefix: "OnePlus / Qualcomm RF",
        rssiDbm: -54,
        protocol: "Cellular Handshake & Wi-Fi Scan",
        emRadiationSignature: "Strong RF Transmission"
      },
      accessibility: {
        rubbleType: "Shattered Glass & Light Pre-cast Tiles",
        extractionDifficulty: "Easy",
        estimatedTimeMinutes: 10,
        requiredEquipment: ["Work Gloves", "Bolt Cutters", "First Aid Kit"]
      },
      environmentalHazard: "Very Low - Cleared corridor access",
      recommendationSummary: "Shallow depth (0.4m) with strong breathing rhythm and phone signal. First-response scout team can extract in <10 mins."
    },
    {
      id: "VIC-04",
      tag: "Survivor #4 (Deep Stairwell Pocket)",
      detectionType: "RADAR_BREATHING_ONLY",
      detectionBadge: "UWB Respiration Only (Phone Crushed / Dead Battery)",
      badgeColor: "#dc2626",
      coords: { x: 38, y: -3.2, z: -28 },
      surfaceCoords: { x: 38, y: 2.1, z: -28 },
      depthMeters: 3.2,
      priorityLevel: "CRITICAL",
      calculatedScore: 97.4,
      vitals: {
        respirationDetected: true,
        breathsPerMin: 7, // CRITICALLY SLOW BREATHING
        cardiacMotionDetected: false,
        heartRateBpm: null,
        motionConfidence: "71% (Weak periodic micro-motion)",
        radarSNR: "+7.2 dB"
      },
      thermal: {
        fissurePlumeDetected: false,
        temperatureDeltaC: "+0.4°C (Trace dissipation)",
        ventType: "Tortuous narrow crack"
      },
      digitalRescue: {
        sdrDeviceDetected: false,
        deviceName: "No RF Transmission (Battery Depleted or Shielded)",
        macPrefix: "None",
        rssiDbm: -105,
        protocol: "No Signal",
        emRadiationSignature: "Undetected"
      },
      accessibility: {
        rubbleType: "Stacked Pre-Stressed Stairwell Slabs",
        extractionDifficulty: "Extreme",
        estimatedTimeMinutes: 70,
        requiredEquipment: ["Heavy Hydraulic Spreaders", "Air Lifting Bags", "Trench Shoring"]
      },
      environmentalHazard: "High - Overhanging fractured roof with 35° tilt",
      recommendationSummary: "LIFE CRITICAL: Person would be completely lost without UWB radar sensing. No phone detected. Respiration critically depressed (7 bpm). Heavy shoring unit required immediately."
    },
    {
      id: "VIC-05",
      tag: "Survivor #5 (Vehicle Pocket Ramp)",
      detectionType: "PHONE_HEARTBEAT_BREATHING",
      detectionBadge: "Phone + Smartwatch + Respiration Detected",
      badgeColor: "#7c3aed",
      coords: { x: 12, y: -1.7, z: -35 },
      surfaceCoords: { x: 12, y: 1.4, z: -35 },
      depthMeters: 1.7,
      priorityLevel: "HIGH",
      calculatedScore: 88.0,
      vitals: {
        respirationDetected: true,
        breathsPerMin: 15,
        cardiacMotionDetected: true,
        heartRateBpm: 82,
        motionConfidence: "89% (Thoracic expansion confirmed)",
        radarSNR: "+15.1 dB"
      },
      thermal: {
        fissurePlumeDetected: true,
        temperatureDeltaC: "+1.9°C",
        ventType: "Drainage cavity chimney"
      },
      digitalRescue: {
        sdrDeviceDetected: true,
        deviceName: "Pixel 8 + Pixel Watch 2 (BLE Mesh)",
        macPrefix: "Google LLC Mobile & Wearable",
        rssiDbm: -66,
        protocol: "Wi-Fi Direct & Wearable BLE Heart Service",
        emRadiationSignature: "Clock Signal Verified"
      },
      accessibility: {
        rubbleType: "Vehicle Frame & Crushed Concrete",
        extractionDifficulty: "Moderate",
        estimatedTimeMinutes: 25,
        requiredEquipment: ["Jaws of Life", "Stabilizing Wedges"]
      },
      environmentalHazard: "Moderate - Fuel vapor caution",
      recommendationSummary: "Dual digital devices (phone + smartwatch) and steady respiration. Approach with non-sparking hydraulic tools."
    }
  ],

  hazardZones: [
    {
      id: "HAZ-01",
      name: "Tilt-Slab Collapse Zone (Severe Instability)",
      coords: { x: 26, y: 0, z: -15 },
      radius: 20,
      riskLevel: "HIGH",
      color: 0xff3b30,
      costFactor: 95,
      description: "Severe shear cracks in remaining pillars. Secondary collapse hazard high under wind or vibration."
    },
    {
      id: "HAZ-02",
      name: "Debris Slope & Loose Masonry Mound",
      coords: { x: -22, y: 0, z: 8 },
      radius: 16,
      riskLevel: "MODERATE",
      color: 0xff9500,
      costFactor: 60,
      description: "32° steep rubble slope with rolling debris danger. Requires stabilizing safety ropes."
    },
    {
      id: "HAZ-03",
      name: "Flooded Underground Utility Trench",
      coords: { x: -8, y: 0, z: 32 },
      radius: 12,
      riskLevel: "HIGH",
      color: 0xff2d55,
      costFactor: 88,
      description: "Submerged ruptured water main and exposed 440V electrical cabling."
    },
    {
      id: "HAZ-04",
      name: "Cleared Concrete Service Road (Safe Corridor)",
      coords: { x: -35, y: 0, z: -2 },
      radius: 24,
      riskLevel: "SAFE",
      color: 0x34c759,
      costFactor: 10,
      description: "Cleared perimeter pathway surveyed safe by drone LiDAR. Recommended ingress route."
    }
  ],

  droneFlightPath: [
    { x: -50, y: 15, z: 50 },
    { x: -35, y: 13, z: 25 },
    { x: -14, y: 12, z: -10 },
    { x: 12, y: 14, z: -35 },
    { x: 38, y: 13, z: -28 },
    { x: 22, y: 12, z: 18 },
    { x: -32, y: 12, z: 24 },
    { x: 0, y: 15, z: 0 }
  ]
};
