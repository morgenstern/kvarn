import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip } from "@kvarn/ui";
import type { Setup as SetupType } from "@kvarn/db";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];
const ONBOARDING_SEEN_KEY = "kvarn:onboardingSeen";

export function markOnboardingSeen() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
}

type Step = "method" | "equipment" | "bean" | "location";

export function Onboarding() {
  const t = useT("onboarding");
  const tSetup = useT("setup");
  const tRegal = useT("regal");
  const navigate = useNavigate();
  const {
    products,
    addEquipmentFromProduct,
    addCustomEquipment,
    addSetup,
    addBean,
    captureWeatherSnapshot,
    setActiveSetup,
    setActiveBean,
  } = useKvarnStore();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<SetupType["method"] | null>(null);
  const [query, setQuery] = useState("");
  const [roaster, setRoaster] = useState("");
  const [beanName, setBeanName] = useState("");

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.kind === "grinder" && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 6);
  }, [products, query]);

  async function finish(withWeather: boolean) {
    markOnboardingSeen();
    if (withWeather) {
      captureWeatherSnapshot();
    }
    navigate({ to: "/bruehen" });
  }

  // Onboarding represents the user's primary setup/bean — always activate what
  // they just created here, even if an older setup/bean was already active
  // (e.g. leftover local data from a previous install).
  async function pickEquipmentFromProduct(productId: string) {
    const equipment = await addEquipmentFromProduct(productId);
    if (method) {
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  async function pickCustomEquipment() {
    const equipment = await addCustomEquipment(query);
    if (method) {
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  async function saveBean() {
    if (!roaster || !beanName) return;
    const bean = await addBean({ roaster, name: beanName });
    setActiveBean(bean.id);
    setStep("location");
  }

  // Skipping equipment must still leave a usable setup — otherwise the user
  // finishes onboarding with no way to brew, silently defeating its purpose.
  async function skipEquipment() {
    if (method) {
      const equipment = await addCustomEquipment(t("genericGrinderName"));
      const setup = await addSetup({ name: method, method, grinderEquipmentId: equipment.id });
      setActiveSetup(setup.id);
    }
    setStep("bean");
  }

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">{t("welcomeTitle")}</h1>
      <p className="text-sm text-muted">{t("welcomeSubtitle")}</p>

      {step === "method" ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("stepMethod")}</div>
          <p className="text-sm mb-3">{t("methodQuestion")}</p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
                {m}
              </Chip>
            ))}
          </div>
          <Button disabled={!method} onClick={() => setStep("equipment")}>
            {t("next")}
          </Button>
        </Card>
      ) : null}

      {step === "equipment" ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("stepEquipment")}</div>
          <p className="text-sm mb-3">{t("equipmentQuestion")}</p>
          <input
            className="border border-linen rounded-control px-3 py-2 text-sm bg-birch w-full"
            placeholder={tSetup("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left text-sm py-2 border-b border-linen last:border-b-0"
              onClick={() => pickEquipmentFromProduct(p.id)}
            >
              {p.brand} {p.model}
            </button>
          ))}
          {query && filteredProducts.length === 0 ? (
            <button type="button" className="text-[13px] text-copper underline mt-2" onClick={pickCustomEquipment}>
              „{query}“ →
            </button>
          ) : null}
          <Button variant="ghost" onClick={skipEquipment}>
            {t("skip")}
          </Button>
        </Card>
      ) : null}

      {step === "bean" ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("stepBean")}</div>
          <p className="text-sm mb-3">{t("beanQuestion")}</p>
          <div className="flex flex-col gap-3">
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder={tRegal("roasterPlaceholder")}
              value={roaster}
              onChange={(e) => setRoaster(e.target.value)}
            />
            <input
              className="border border-linen rounded-control px-3 py-2 text-sm bg-birch"
              placeholder={tRegal("namePlaceholder")}
              value={beanName}
              onChange={(e) => setBeanName(e.target.value)}
            />
            <Button disabled={!roaster || !beanName} onClick={saveBean}>
              {t("next")}
            </Button>
            <Button variant="ghost" onClick={() => setStep("location")}>
              {t("skip")}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "location" ? (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{t("stepLocation")}</div>
          <p className="text-sm mb-3">{t("locationQuestion")}</p>
          <p className="text-xs text-muted mb-3">{t("locationExplainer")}</p>
          <Button onClick={() => finish(true)}>{t("locationAllow")}</Button>
          <Button variant="ghost" onClick={() => finish(false)}>
            {t("locationSkip")}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
