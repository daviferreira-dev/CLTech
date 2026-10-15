-- Princípio II (Constituição) / FR-028: score objetivo e imutável.
-- Nenhuma rota de update é exposta na aplicação (barreira 1), e a correção se dá
-- por reprocessamento versionado (barreira 2 — ver Evaluation.version). Esta trigger
-- é a barreira 3: bloqueia UPDATE mesmo por acesso direto ao banco.
--
-- Teste obrigatório (research.md R8 / quickstart.md): um UPDATE em "Evaluation" MUST
-- falhar com esta exceção. Ver tests/integration/evaluation-immutable.test.ts.

CREATE OR REPLACE FUNCTION evaluation_block_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Evaluation is immutable (Principio II / FR-028): reprocess as a new version instead of updating id=%',
    OLD.id
  USING ERRCODE = '23506'; -- não permite restrição de chave estrangeira, usado aqui para violacao de regra de imutabilidade
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_immutable
BEFORE UPDATE ON "Evaluation"
FOR EACH ROW
EXECUTE FUNCTION evaluation_block_update();
