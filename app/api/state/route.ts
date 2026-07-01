export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getGameState, upsertGameState, getPlayer, getActiveAttacksOn } from '@/lib/db';
import {
  deserializeState,
  serializeState,
  initialGameState,
  validateStateDelta,
  type FullGameState,
} from '@/lib/game-engine';

const ANTIMATTER_QUESTIONS = [
  {
    id: "ceo_antimatter",
    question: "Who is the Co-founder, Executive Chairman, and CEO of Antimatter?",
    options: ["Kyllian Mbappe", "David Gurlé", "Tim Cook", "Queenie Chan"],
    correctAnswer: "David Gurlé",
    penaltyType: "cpu"
  },


  {
    id: "pc_definition",
    question: "What is the primary function of PoliCloud in the context of Hivenet and Antimatter?",
    options: ["A social media platform", "A sovereign, modular micro-data center network", "A consumer VPN service", "A blockchain wallet"],
    correctAnswer: "A sovereign, modular micro-data center network",
    penaltyType: "node"
  },
  {
    id: "pc_target",
    question: "Which of these groups is a target audience for PoliCloud's sovereign infrastructure?",
    options: ["Only individual gamers", "Farmers, enterprises, and public institutions", "Only mobile app developers", "Cryptocurrency day traders"],
    correctAnswer: "Farmers, enterprises, and public institutions",
    penaltyType: "cpu"
  },
  {
    id: "pc_workload",
    question: "PoliCloud is specifically designed to handle which type of intensive computing tasks?",
    options: ["Basic word processing", "HPC and AI inference workloads", "Simple email hosting", "Ad-supported web hosting"],
    correctAnswer: "HPC and AI inference workloads",
    penaltyType: "gpu"
  },
  {
    id: "pc_sovereignty",
    question: "Why does David Gurlé emphasize 'sovereign infrastructure' for running Open Source LLMs?",
    options: ["To sell user data to big tech", "To ensure control, transparency, and security over AI systems", "To require internet access to operate", "To centralize all data in one location"],
    correctAnswer: "To ensure control, transparency, and security over AI systems",
    penaltyType: "power"
  },
  {
    id: "pc_backbone",
    question: "In the context of Antimatter, what role does PoliCloud play?",
    options: ["It forms the physical backbone of the infrastructure", "It acts as a browser extension", "It is a marketing agency", "It is the name of the CEO's personal computer"],
    correctAnswer: "It forms the physical backbone of the infrastructure",
    penaltyType: "bandwidth"
  },
  {
    id: "am_cpu",
    question: "Which component is considered the 'brain' responsible for executing the basic instructions of a server?",
    options: ["GPU", "CPU", "RAM", "SSD"],
    correctAnswer: "CPU",
    penaltyType: "cpu" 
  },
  {
    id: "hivenet_storage",
    question: "Which Hivenet product is primarily intended for personal cloud storage?",
    options: ["Compute", "Send", "Store", "Archive"],
    correctAnswer: "Store",
    penaltyType: "ram" // Linked to node-based storage
  },
  {
    id: "hivenet_compute",
    question: "What is the primary focus of the Hivenet 'Compute' product?",
    options: ["File sharing", "Distributed storage", "GPU/AI workloads", "Instant messaging"],
    correctAnswer: "GPU/AI workloads",
    penaltyType: "gpu"
  },
  {
    id: "hivenet_security",
    question: "What does Hivenet call the optional layer of protection that makes files unrecoverable if lost?",
    options: ["Master Key", "Encryption Passphrase", "Unique Password", "Security Token"],
    correctAnswer: "Encryption Passphrase",
    penaltyType: "cpu"
  },
  {
    id: "hivenet_diff",
    question: "What is the primary difference between a centralized cloud and Hivenet's distributed cloud?",
    options: ["Hivenet uses blockchains", "Hivenet does not rely on large centralized data centers", "Hivenet is a Web3 company", "Hivenet only works locally"],
    correctAnswer: "Hivenet does not rely on large centralized data centers",
    penaltyType: "bandwidth" // Linked to data transfer
  },
  {
    id: "hivenet_nature",
    question: "Does Hivenet define itself as a Web3 company using tokens and blockchain technology?",
    options: ["Yes, it is their core business", "No, they focus on real infrastructure", "Only for payments", "Yes, for security"],
    correctAnswer: "No, they focus on real infrastructure",
    penaltyType: "bandwith"
  },
  {
    id: "hivenet_performance",
    question: "Why does Hivenet's distributed model often provide better performance?",
    options: ["It uses larger servers", "It retrieves data from multiple sources simultaneously", "It removes encryption", "It uses private fiber connections"],
    correctAnswer: "It retrieves data from multiple sources simultaneously",
    penaltyType: "cpu"
  },
  {
    id: "am_ram",
    question: "Which memory is considered 'volatile' and is completely wiped when the server is restarted?",
    options: ["Hard Drive", "ROM", "RAM", "L3 Cache"],
    correctAnswer: "RAM",
    penaltyType: "ram"
  },
  {
    id: "am_gpu",
    question: "Which hardware is specifically optimized for massive parallel computing (such as AI training)?",
    options: ["CPU", "GPU", "Container Node", "Switch"],
    correctAnswer: "GPU",
    penaltyType: "gpu"
  },
  {
    id: "am_power",
    question: "What does the acronym 'UPS' stand for in a data center context?",
    options: ["Universal Power Supply", "Uninterruptible Power Supply", "Unified Processing System", "Ultra Power Surge"],
    correctAnswer: "Uninterruptible Power Supply",
    penaltyType: "power" 
  },
  {
    id: "am_bw",
    question: "In distributed computing (HPC), which collective communication operation synchronizes and reduces data across all nodes?",
    options: ["All-Gather", "Broadcast", "All-Reduce", "Scatter"],
    correctAnswer: "All-Reduce",
    penaltyType: "gpu"
  },
  {
    id: "am_node",
    question: "Which technology allows for isolating an application and its dependencies in a lightweight, portable environment?",
    options: ["Virtualization (VM)", "Containerization (Docker)", "RAID", "VPN"],
    correctAnswer: "Containerization (Docker)",
    penaltyType: "node" 
  }
];

function getPlayerId(req: NextRequest): string | null {
  return req.cookies.get('player_id')?.value ?? null;
}

export async function GET(req: NextRequest) {
  const playerId = getPlayerId(req);
  if (!playerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const player = getPlayer(playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const row = getGameState(playerId);
  if (!row) {
    const initial = initialGameState();
    return NextResponse.json({ state: initial });
  }

  const state = deserializeState(row.state_json);
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest) {
  const playerId = getPlayerId(req);
  if (!playerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const player = getPlayer(playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json() as { state?: FullGameState };
  if (!body.state) return NextResponse.json({ error: 'Missing state' }, { status: 400 });

  const incoming = body.state;

  const row = getGameState(playerId);
  const previous = row ? deserializeState(row.state_json) : null;

  const activeAttacks = getActiveAttacksOn(playerId);
  const attackMultiplier = activeAttacks.length > 0 ? 0.7 : 1.0;

  if (!validateStateDelta(previous, incoming, 10, attackMultiplier)) {
    return NextResponse.json({ error: 'Invalid state delta' }, { status: 400 });
  }

  upsertGameState(playerId, incoming.totalEarned, serializeState(incoming));

  // --- NOUVEAU : Inventaire du joueur ---
  // On crée un Set (une liste sans doublons) pour stocker les types de composants possédés
  const ownedComponents = new Set<string>();
  
  // On parcourt toutes les régions du joueur
  for (const region of Object.values(incoming.regions)) {
    // Pour chaque région, on regarde ses composants
    for (const [componentType, count] of Object.entries(region.components)) {
      if ((count as number) > 0) {
        ownedComponents.add(componentType); // Si on en a au moins 1, on l'ajoute à la liste
      }
    }
  }
  // ---------------------------------------

  const PROBABILITE = 0.03; 
  let qcmEvent = null;

  // --- NOUVEAU : Filtrage des questions ---
  // On ne garde dans notre chapeau que les questions dont le joueur possède le matériel
  const availableQuestions = ANTIMATTER_QUESTIONS.filter(q => ownedComponents.has(q.penaltyType));

  // On lance le dé SEULEMENT si le joueur possède au moins un type de matériel
  if (availableQuestions.length > 0 && Math.random() < PROBABILITE) {
    // On pioche au hasard parmi les questions valides
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    qcmEvent = availableQuestions[randomIndex];
  }
  // ----------------------------------------

  return NextResponse.json({ 
    ok: true,
    qcmEvent: qcmEvent 
  });
}