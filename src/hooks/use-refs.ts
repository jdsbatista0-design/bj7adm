import { useQuery } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";

export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const r = await from("empresas").select("*").order("nome");
      if (r.error) throw r.error;
      return asRows("empresas", r.data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnidades() {
  return useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const r = await from("unidades").select("*").order("nome");
      if (r.error) throw r.error;
      return asRows("unidades", r.data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const r = await from("categorias").select("*").order("nome");
      if (r.error) throw r.error;
      return asRows("categorias", r.data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
