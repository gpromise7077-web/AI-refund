import Groq from "groq-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const customers = [
  {
    customerId: "CUST-001",
    name: "Ada Okafor",
    email: "ada.okafor@email.com",
    orders: [
      {
        orderId: "ORD-1001",
        product: "iPhone 12 Pro Max",
        category: "electronics",
        price: 950,
        purchaseDate: "2026-09-10",
        status: "delivered",
        finalSale: false,
      },
    ],
  },
  {
    customerId: "CUST-002",
    name: "James Okeke",
    email: "james.okeke@email.com",
    orders: [
      {
        orderId: "ORD-1002",
        product: "Nike Air Force 1",
        category: "fashion",
        price: 120,
        purchaseDate: "2026-09-20",
        status: "delivered",
        finalSale: false,
      },
    ],
  },
  {
    customerId: "CUST-004",
    name: "Chinedu Eze",
    email: "chinedu.eze@email.com",
    orders: [
      {
        orderId: "ORD-1004",
        product: "Clearance Hoodie",
        category: "fashion",
        price: 35,
        purchaseDate: "2026-09-18",
        status: "delivered",
        finalSale: true,
      },
    ],
  },
  {
    customerId: "CUST-005",
    name: "Fatima Bello",
    email: "fatima.bello@email.com",
    orders: [
      {
        orderId: "ORD-1005",
        product: "MacBook Air M2",
        category: "electronics",
        price: 1200,
        purchaseDate: "2026-09-05",
        status: "delivered",
        finalSale: false,
      },
    ],
  },
];

const REFUND_WINDOWS: Record<string, number> = {
  electronics: 30,
  fashion: 14,
  home: 30,
};

const TODAY = new Date("2026-09-27");

function findOrderById(orderId: string) {
  for (const customer of customers) {
    const order = customer.orders.find(
      (o) => o.orderId.toUpperCase() === orderId.toUpperCase(),
    );
    if (order) return { customer, order };
  }
  return null;
}

function findOrderByProductName(text: string) {
  const lowerText = text.toLowerCase();

  for (const customer of customers) {
    for (const order of customer.orders) {
      if (lowerText.includes(order.product.toLowerCase())) {
        return { customer, order };
      }
    }
  }
  return null;
}

// Try every reasonable way to find the order the customer means
function resolveOrder(message: string) {
  // 1. Look for "ORD-1234", "ORD1234", or "ord 1234" style patterns
  const idMatch = message.match(/ord[\s-]?(\d{3,})/i);
  if (idMatch) {
    const orderId = `ORD-${idMatch[1]}`;
    const found = findOrderById(orderId);
    if (found) return found;
  }

  // 2. Look for a bare number, e.g. "order 1001" or just "1001"
  const numberMatch = message.match(/\b(\d{4,})\b/);
  if (numberMatch) {
    const orderId = `ORD-${numberMatch[1]}`;
    const found = findOrderById(orderId);
    if (found) return found;
  }

  // 3. Fall back to matching by product name mentioned in the message
  return findOrderByProductName(message);
}

function daysBetween(dateString: string): number {
  const purchaseDate = new Date(dateString);
  const diffMs = TODAY.getTime() - purchaseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function decideRefund(order: any, customerReason: string) {
  const daysSincePurchase = daysBetween(order.purchaseDate);
  const allowedDays = REFUND_WINDOWS[order.category] ?? 30;
  const reasonLower = customerReason.toLowerCase();

  const eligibleReason =
    reasonLower.includes("damaged") ||
    reasonLower.includes("defective") ||
    reasonLower.includes("not working") ||
    reasonLower.includes("wrong item") ||
    reasonLower.includes("not as described");

  let decision: "APPROVE" | "DENY" | "ESCALATE";
  let explanation: string;

  if (order.finalSale) {
    decision = "DENY";
    explanation = `${order.product} was a final sale item.`;
  } else if (order.price > 500) {
    decision = "ESCALATE";
    explanation = `Order value ($${order.price}) exceeds $500, requires human review.`;
  } else if (daysSincePurchase > allowedDays) {
    decision = "DENY";
    explanation = `Purchased ${daysSincePurchase} days ago, past the ${allowedDays}-day window.`;
  } else if (eligibleReason) {
    decision = "APPROVE";
    explanation = `Valid reason given, within the ${allowedDays}-day window.`;
  } else {
    decision = "ESCALATE";
    explanation = `Reason unclear, needs human review.`;
  }

  return { decision, explanation };
}

const policy = `
You are a customer support refund assistant. You will be given a DECISION and a short EXPLANATION already determined by the refund policy engine.

Relay this to the customer in 1-2 short sentences, warm but concise. Do not repeat the raw explanation word for word — rephrase it naturally. Do not add extra caveats, disclaimers, or repeat policy details beyond what's needed. Get straight to the point.
`;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const found = resolveOrder(data.message);

    if (!found) {
      return Response.json(
        {
          message:
            "I couldn't find that order — could you share your order ID or the product name?",
        },
        { headers: corsHeaders },
      );
    }

    const { order } = found;
    const result = decideRefund(order, data.message);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: policy },
        {
          role: "user",
          content: `DECISION: ${result.decision}\nEXPLANATION: ${result.explanation}\nCustomer said: "${data.message}"`,
        },
      ],
    });

    const response = completion.choices[0]?.message?.content;

    return Response.json({ message: response }, { headers: corsHeaders });
  } catch (error) {
    console.error("ERROR:", error);
    return Response.json(
      { message: "AI request failed." },
      { status: 500, headers: corsHeaders },
    );
  }
}
