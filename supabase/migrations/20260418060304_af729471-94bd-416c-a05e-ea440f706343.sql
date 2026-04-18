-- Trigger: ao inserir item utilizado em um chamado, dar baixa automática no estoque do veículo
CREATE OR REPLACE FUNCTION public.baixa_estoque_veiculo_chamado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_qtd_atual NUMERIC;
BEGIN
  SELECT quantidade INTO v_qtd_atual FROM public.estoque_veiculo WHERE id = NEW.item_id;
  IF v_qtd_atual IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.estoque_veiculo
  SET quantidade = GREATEST(0, v_qtd_atual - NEW.quantidade),
      updated_at = now()
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baixa_estoque_chamado ON public.chamado_itens_utilizados;
CREATE TRIGGER trg_baixa_estoque_chamado
AFTER INSERT ON public.chamado_itens_utilizados
FOR EACH ROW
EXECUTE FUNCTION public.baixa_estoque_veiculo_chamado();