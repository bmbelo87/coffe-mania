/**
 * Termos de Uso, Política de Privacidade e Código de Conduta do alpha. A versão precisa ser
 * igual a `LegalVersion` em database/access.go: o servidor registra o aceite com ela e recusa
 * páginas com um texto antigo. Mudou o texto, suba a versão nos dois lugares.
 *
 * Rascunho escrito para o alpha; recomenda-se revisão jurídica antes da abertura.
 * `{contato}` é trocado pelo email de contato configurado no servidor.
 */
export const LEGAL_VERSION = '2026-10-25';

export type LegalDocId = 'termos' | 'privacidade' | 'conduta';

export interface LegalDoc {
  title: string;
  intro: string;
  sections: { title: string; paragraphs: string[] }[];
}

export const LEGAL_PATHS: Record<LegalDocId, string> = { termos: '/termos', privacidade: '/privacidade', conduta: '/conduta' };

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  termos: {
    title: 'Termos de Uso',
    intro: 'Estes termos valem para o alpha fechado do Café Mania. Ao criar sua conta, você concorda com eles, com a Política de Privacidade e com o Código de Conduta.',
    sections: [
      {
        title: 'Um projeto de fãs',
        paragraphs: [
          'O Café Mania original foi um jogo da Vostu, lançado na época do Orkut e encerrado anos depois. Este projeto é feito por fãs, sem fins lucrativos, para preservar e trazer de volta essa experiência.',
          'Não temos vínculo com a Vostu nem com os atuais detentores dos direitos do jogo. Nomes, marcas e artes originais pertencem aos seus donos. Se você representa um detentor de direitos e quer que algum conteúdo seja retirado, escreva para {contato}: atenderemos o pedido.',
        ],
      },
      {
        title: 'O que é o alpha',
        paragraphs: [
          'O alpha é uma fase de testes, aberta só para convidados maiores de 18 anos. O convite é pessoal e não pode ser vendido nem repassado.',
          'O jogo ainda tem erros e muda com frequência. Ele pode ficar fora do ar para manutenção, ter partes desligadas ou ser encerrado a qualquer momento, sem garantia de funcionamento.',
          'O progresso do alpha (níveis, moedas, itens e o café) será apagado quando o beta chegar. Quem jogar o alpha fica com o selo de Fundador.',
        ],
      },
      {
        title: 'Sem dinheiro real',
        paragraphs: [
          'Nada no jogo é vendido. CaféOuros, caféGranas, itens e contas não têm valor em dinheiro e não podem ser comprados, vendidos ou trocados por dinheiro ou bens fora do jogo.',
        ],
      },
      {
        title: 'Sua conta',
        paragraphs: [
          'Você é responsável pela sua senha e pelo que acontece na sua conta. Use uma senha só sua; se desconfiar de acesso indevido, troque a senha e use "Sair de todos os aparelhos".',
          'Você pode excluir sua conta quando quiser, na página Minha conta.',
        ],
      },
      {
        title: 'Suspensões',
        paragraphs: [
          'Quem descumprir estes termos ou o Código de Conduta pode ter a conta suspensa por um prazo ou de forma definitiva. O motivo aparece ao tentar entrar. Para contestar, escreva para {contato}.',
        ],
      },
      {
        title: 'Mudanças nestes termos',
        paragraphs: [
          'Se os termos mudarem, avisaremos no jogo e pediremos um novo aceite. A data da versão aparece no topo desta página.',
        ],
      },
    ],
  },
  privacidade: {
    title: 'Política de Privacidade',
    intro: 'Coletamos o mínimo para o jogo funcionar com segurança e para entender como ele está sendo jogado. Esta política segue a Lei Geral de Proteção de Dados (LGPD).',
    sections: [
      {
        title: 'O que coletamos',
        paragraphs: [
          'Lista de espera: nome, email, a lembrança do Café Mania que você quiser contar e a data da confirmação.',
          'Conta: email, nome no jogo, senha (guardada só como código irreversível), confirmação de idade, aceite destes termos e a onda de convite.',
          'Jogo: seu café, itens, progresso e ações dentro do jogo, como cozinhar, servir e comprar com as moedas do jogo.',
          'Dados técnicos: endereço IP e informações do navegador, usados para segurança, limite de tentativas e correção de erros; e métricas de uso, como duração das sessões e telas usadas.',
        ],
      },
      {
        title: 'Para que usamos',
        paragraphs: [
          'Para fazer o jogo funcionar, enviar convites e emails da conta (confirmação e nova senha), proteger o jogo contra fraudes e ataques e melhorar o jogo a partir de números agregados.',
          'Bases legais: o seu consentimento (lista de espera), a execução destes termos (conta e jogo) e o legítimo interesse (segurança e métricas). Não fazemos publicidade nem vendemos dados.',
        ],
      },
      {
        title: 'Com quem compartilhamos',
        paragraphs: [
          'Só com quem nos ajuda a manter o jogo no ar: a empresa de hospedagem do servidor, a Cloudflare (proteção contra ataques e entrega do site) e o serviço que envia os emails. Eles tratam os dados apenas para prestar esse serviço.',
        ],
      },
      {
        title: 'Por quanto tempo',
        paragraphs: [
          'Conta e dados do jogo: até você excluir a conta ou o projeto terminar. Lista de espera: até virar uma conta ou você pedir a remoção. Registros técnicos e métricas detalhadas: até 90 dias; números agregados podem ficar por mais tempo. Cópias de segurança: até 7 dias.',
        ],
      },
      {
        title: 'Cookies',
        paragraphs: [
          'Usamos só o cookie necessário para manter você conectado. Não usamos cookies de publicidade. No formulário da lista de espera, o Cloudflare Turnstile verifica se quem preenche é uma pessoa.',
        ],
      },
      {
        title: 'Seus direitos',
        paragraphs: [
          'Na página Minha conta você baixa uma cópia dos seus dados e exclui a conta com todo o progresso. Para corrigir dados, sair da lista de espera ou qualquer outro pedido, escreva para {contato}.',
          'O jogo é só para maiores de 18 anos. Se soubermos que uma conta é de alguém mais novo, ela será excluída.',
        ],
      },
    ],
  },
  conduta: {
    title: 'Código de Conduta',
    intro: 'O Café Mania é um lugar para se divertir e relembrar. Para todo mundo continuar se divertindo:',
    sections: [
      {
        title: 'Respeito',
        paragraphs: [
          'Nada de ofensas, assédio, discriminação ou conteúdo sexual ou violento em nomes, cafés ou mensagens. Não finja ser da equipe do projeto.',
        ],
      },
      {
        title: 'Jogo limpo',
        paragraphs: [
          'Não use programas, robôs, scripts ou alterações no jogo para ganhar vantagem, nem várias contas. Não ataque o servidor nem tente acessar contas ou dados de outras pessoas.',
          'Achou um erro que dá vantagem? Conte para a equipe em vez de usar: no alpha, achar problemas é justamente a ajuda que mais vale.',
        ],
      },
      {
        title: 'Contas e convites',
        paragraphs: [
          'Uma conta por pessoa. Não venda, compartilhe ou troque contas e convites.',
        ],
      },
      {
        title: 'Consequências',
        paragraphs: [
          'Dependendo da gravidade: aviso, suspensão por um prazo ou exclusão definitiva da conta. Dúvidas ou contestações: {contato}.',
        ],
      },
    ],
  },
};
