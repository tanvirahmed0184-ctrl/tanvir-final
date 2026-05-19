import Link from "next/link";
import { Check, X } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  featured?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Great for getting started with IELTS practice.",
    cta: "Start Free",
    features: [
      "Limited practice tests",
      "Basic progress tracking",
      "1 AI writing check/day",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "Best for serious learners targeting faster score gains.",
    cta: "Choose Pro",
    featured: true,
    features: [
      "Unlimited skill tests",
      "Full simulation exams",
      "Advanced analytics dashboard",
      "AI speaking + writing evaluations",
      "Priority support",
    ],
  },
  {
    name: "Premium",
    price: "$39",
    period: "/month",
    description: "Complete prep suite with mentor-focused workflow.",
    cta: "Choose Premium",
    features: [
      "Everything in Pro",
      "Instructor booking priority",
      "Detailed evaluator notes",
      "Team + family sharing options",
      "Performance consultation",
    ],
  },
];

const comparisonRows = [
  {
    feature: "Practice tests",
    free: "Limited",
    pro: "Unlimited",
    premium: "Unlimited",
  },
  {
    feature: "Full simulation exams",
    free: false,
    pro: true,
    premium: true,
  },
  {
    feature: "AI writing evaluation",
    free: "1/day",
    pro: "Unlimited",
    premium: "Unlimited",
  },
  {
    feature: "AI speaking evaluation",
    free: false,
    pro: true,
    premium: true,
  },
  {
    feature: "Instructor booking",
    free: false,
    pro: true,
    premium: "Priority",
  },
  {
    feature: "Priority support",
    free: false,
    pro: true,
    premium: true,
  },
  {
    feature: "Advanced analytics",
    free: false,
    pro: true,
    premium: true,
  },
];

function renderCell(value: string | boolean) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-slate-700">{value}</span>;
  }

  return value ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      <Check size={14} />
    </span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <X size={14} />
    </span>
  );
}

export default function PricingPage() {
  return (
    <div className="space-y-14 pb-10">
      <section className="bg-gradient-to-b from-brand-purple via-brand-purple-dark to-brand-teal py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/85">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Choose the Plan That Fits Your IELTS Goal
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
            Transparent monthly plans with everything you need to reach your
            target band faster.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                "relative rounded-2xl border bg-white p-6 shadow-sm",
                plan.featured
                  ? "border-brand-teal ring-2 ring-brand-teal/30"
                  : "border-brand-purple/15",
              ].join(" ")}
            >
              {plan.featured ? (
                <span className="absolute -top-3 right-4 rounded-full bg-brand-teal px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              ) : null}

              <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{plan.description}</p>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black text-slate-900">
                  {plan.price}
                </span>
                <span className="pb-1 text-sm text-slate-500">
                  {plan.period}
                </span>
              </div>

              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="inline-flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check size={16} className="mt-0.5 text-brand-teal" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={[
                  "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                  plan.featured
                    ? "bg-gradient-to-r from-brand-purple to-brand-teal text-white"
                    : "border border-brand-purple/30 text-brand-purple hover:bg-brand-purple/5",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="overflow-hidden rounded-2xl border border-brand-purple/15 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Feature Comparison
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-white">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feature
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Free
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-brand-teal">
                    Pro
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {comparisonRows.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      {row.feature}
                    </td>
                    <td className="px-5 py-3">{renderCell(row.free)}</td>
                    <td className="px-5 py-3">{renderCell(row.pro)}</td>
                    <td className="px-5 py-3">{renderCell(row.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4">
        <div className="rounded-2xl bg-gradient-to-r from-brand-purple to-brand-teal p-8 text-center text-white">
          <h3 className="text-2xl font-bold">
            Ready to start improving your band score?
          </h3>
          <p className="mt-2 text-sm text-white/90">
            Create your IELTS Flow account and begin with the Free plan in
            minutes.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-purple"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
