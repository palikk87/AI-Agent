import { api } from "@/lib/api";
import type {
  CatalogResponse,
  ColorOption,
  DoorSize,
  SwapResult,
  GarageStyle,
  Manufacturer,
  WindowOption,
} from "../../../backend/src/types";

export type { CatalogResponse, ColorOption, DoorSize, SwapResult, GarageStyle, Manufacturer, WindowOption };

export const garageApi = {
  catalog: async (): Promise<CatalogResponse> => {
    const res = await fetch("/catalog.json")
    if (!res.ok) throw new Error("Failed to load catalog")
    return res.json() as Promise<CatalogResponse>
  },

  detect: async (image: File): Promise<DoorSize> => {
    const form = new FormData();
    form.append("image", image);
    const resp = await api.raw("/api/garage/detect", { method: "POST", body: form });
    if (!resp.ok) return { widthClass: "double", heightClass: "standard" };
    const json = (await resp.json()) as { data: DoorSize };
    return json.data;
  },

  swap: async (
    image: File,
    styleId: string,
    colorId?: string,
    windowOptionId?: string
  ): Promise<SwapResult> => {
    const form = new FormData();
    form.append("image", image);
    form.append("styleId", styleId);
    if (colorId) form.append("colorId", colorId);
    if (windowOptionId) form.append("windowOptionId", windowOptionId);

    const resp = await api.raw("/api/garage/swap", {
      method: "POST",
      body: form,
    });

    if (!resp.ok) {
      const json = await resp.json().catch(() => null);
      throw new Error(
        json?.error?.message || `Generation failed (${resp.status})`
      );
    }
    const json = (await resp.json()) as { data: SwapResult };
    return json.data;
  },
};
