drop policy if exists "autor ou coordenacao excluem itens do relatorio sem registro" on relatorio_turno_itens;
create policy "autor ou coordenacao excluem itens do relatorio sem registro"
  on relatorio_turno_itens for delete
  to authenticated
  using (
    registro_id_gerado is null
    and (
      papel_atual() = any (array['coordenacao', 'consultor'])
      or registrado_por = auth.uid()
    )
    and exists (
      select 1 from relatorios_turno r
      where r.id = relatorio_turno_itens.relatorio_turno_id
        and r.fechado_em is null
    )
  );
