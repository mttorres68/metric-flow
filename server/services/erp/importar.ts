/* MetricFlow — importação dos arquivos do ERP (upload no ⚙). Pedidos registram uma coleta de origem "erp". */
import { parseProdutos } from "./parseProdutos";
import { parseCabecalhosPedidos, parsePedidosErp } from "./parsePedidosErp";
import * as repo from "./repo";
import * as cn from "../checknow/repo";

export async function importarProdutos(buffer: Buffer): Promise<{ produtos: number; comVolume: number }> {
  const ps = parseProdutos(buffer);
  return { produtos: await repo.salvarProdutos(ps), comVolume: ps.filter(p => p.litrosEmb !== null).length };
}

export async function importarPedidos(revendaId: number, buffer: Buffer): Promise<{ pedidos: number; itens: number; semCadastro: string[] }> {
  const itens = parsePedidosErp(buffer);
  const cabecalhos = parseCabecalhosPedidos(buffer); // coluna nova faltando falha antes da trava
  const datas = itens.flatMap(i => (i.dataPedido ? [i.dataPedido] : [])).sort();
  const hoje = new Date().toISOString().slice(0, 10);
  return cn.comTrava(revendaId, async () => {
    const id = await cn.abrirColeta(revendaId, "erp", datas[0] ?? hoje, datas.at(-1) ?? hoje);
    try {
      if (!itens.length) {
        await cn.fecharColeta(id, revendaId, { status: "sem_dados" });
        return { pedidos: 0, itens: 0, semCadastro: [] };
      }
      const r = await repo.gravarPedidos(revendaId, itens);
      await repo.gravarCabecalhos(revendaId, cabecalhos);
      await cn.fecharColeta(id, revendaId, { status: "ok", rotas: r.pedidos, linhas: r.itens });
      return { ...r, semCadastro: await repo.codigosSemCadastro(itens.map(i => i.codProduto)) };
    } catch (e) {
      await cn.fecharColeta(id, revendaId, { status: "erro", erro: (e as Error).message.split("\n")[0].slice(0, 200) });
      throw e;
    }
  });
}
