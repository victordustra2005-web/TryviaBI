// Função para agrupar status consecutivos iguais
function agruparStatusConsecutivos(statusArray) {
    if (!statusArray || statusArray.length === 0) return [];
    
    const grupos = [];
    let statusAtual = statusArray[0];
    let quantidade = 1;
    
    for (let i = 1; i < statusArray.length; i++) {
        if (statusArray[i] === statusAtual) {
            quantidade++;
        } else {
            grupos.push({ status: statusAtual, quantidade: quantidade });
            statusAtual = statusArray[i];
            quantidade = 1;
        }
    }
    
    // Adicionar o último grupo
    grupos.push({ status: statusAtual, quantidade: quantidade });
    
    return grupos;
}

// Função para verificar se o projeto tem Go Live concluído
function temGoLiveConcluido(implantacao) {
    if (!implantacao.fases) return false;
    
    const goLiveFase = implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('go live') || fase.nome.toLowerCase().includes('golive')
    );
    
    return goLiveFase && (goLiveFase.status === 'concluido-prazo' || goLiveFase.status === 'concluido-fora');
}

// Função para verificar se o projeto tem Kick Off concluído
function temKickOffConcluido(implantacao) {
    if (!implantacao.fases) return false;
    
    const kickOffFase = implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('kick off') || fase.nome.toLowerCase().includes('kickoff')
    );
    
    return kickOffFase && (kickOffFase.status === 'concluido-prazo' || kickOffFase.status === 'concluido-fora');
}

// Função para obter a data de Go Live
function getDataGoLive(implantacao) {
    if (!implantacao.fases) return null;
    
    const goLiveFase = implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('go live') || fase.nome.toLowerCase().includes('golive')
    );
    
    if (goLiveFase && goLiveFase.fim && (goLiveFase.status === 'concluido-prazo' || goLiveFase.status === 'concluido-fora')) {
        return new Date(goLiveFase.fim);
    }
    
    return null;
}

// Função para obter a data de Kick Off
function getDataKickOff(implantacao) {
    if (!implantacao.fases) return null;
    
    const kickOffFase = implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('kick off') || fase.nome.toLowerCase().includes('kickoff')
    );
    
    if (kickOffFase && kickOffFase.inicio) {
        return new Date(kickOffFase.inicio);
    }
    
    return null;
}

// Função para verificar se deve mostrar "sem dados" baseado no Go Live e Kick Off
function deveExibirSemDados(implantacao, ano, mes) {
    const dataGoLive = getDataGoLive(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    // Verificar Go Live (meses posteriores)
    if (dataGoLive) {
        const anoGoLive = dataGoLive.getFullYear();
        const mesGoLive = dataGoLive.getMonth();
        
        // Se o ano solicitado é posterior ao ano do Go Live, sempre "sem dados"
        if (ano > anoGoLive) return true;
        
        // Se é o mesmo ano do Go Live, verificar se o mês é posterior ao Go Live
        if (ano === anoGoLive && mes > mesGoLive) return true;
    }
    
    // Verificar Kick Off (meses anteriores)
    if (dataKickOff) {
        const anoKickOff = dataKickOff.getFullYear();
        const mesKickOff = dataKickOff.getMonth();
        
        // Se o ano solicitado é anterior ao ano do Kick Off, sempre "sem dados"
        if (ano < anoKickOff) return true;
        
        // Se é o mesmo ano do Kick Off, verificar se o mês é anterior ao Kick Off
        if (ano === anoKickOff && mes < mesKickOff) return true;
    }
    
    return false;
}

// Função para verificar se o projeto deve aparecer no ano selecionado
function projetoDeveAparecerNoAno(implantacao, ano) {
    const dataGoLive = getDataGoLive(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    // Se tem Go Live concluído, só mostrar até o ano do Go Live
    if (dataGoLive && ano > dataGoLive.getFullYear()) {
        return false;
    }
    
    // Se tem Kick Off definido, só mostrar a partir do ano do Kick Off
    if (dataKickOff && ano < dataKickOff.getFullYear()) {
        return false;
    }
    
    // Se não tem Kick Off nem Go Live definidos, usar lógica original
    if (!dataKickOff && !dataGoLive) {
        const anoInicio = implantacao.anoInicio || new Date().getFullYear();
        return (anoInicio <= ano && (implantacao.statusMeses[ano] || implantacao.statusMeses.janeiro)) ||
               implantacao.fases.some(fase => {
                   if (fase.inicio && fase.fim) {
                       const dataInicio = new Date(fase.inicio);
                       const dataFim = new Date(fase.fim);
                       const anoFaseInicio = dataInicio.getFullYear();
                       const anoFaseFim = dataFim.getFullYear();
                       return (anoFaseInicio <= ano && anoFaseFim >= ano);
                   }
                   return false;
               });
    }
    
    return true;
}

// Variáveis globais
let implantacoes = [];
let implantacaoAtual = null;
let anoSelecionado = new Date().getFullYear(); // Ano atual por padrão
const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar conexão com Supabase
    const conexaoOk = await SupabaseService.verificarConexao();
    if (!conexaoOk) {
        mostrarMensagem('Erro na conexão com o banco de dados. Usando dados locais.', 'erro');
        carregarDadosLocais(); // Fallback para dados locais
    } else {
        await carregarDadosSupabase();
    }
    
    inicializarFiltroAno();
    carregarPainelProjetos();
    configurarEventListeners();
});

// Inicializar filtro por ano
function inicializarFiltroAno() {
    const filtroAno = document.getElementById('filtro-ano');
    const anoAtual = new Date().getFullYear();
    
    // Adicionar opções de anos (do ano atual até 3 anos atrás e 2 anos à frente)
    for (let ano = anoAtual - 3; ano <= anoAtual + 2; ano++) {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        if (ano === anoAtual) {
            option.selected = true;
        }
        filtroAno.appendChild(option);
    }
    
    // Event listener para mudança de ano
    filtroAno.addEventListener('change', function() {
        anoSelecionado = parseInt(this.value);
        document.getElementById('ano-selecionado').textContent = anoSelecionado;
        carregarPainelProjetos();
    });
}

// Carregar dados do Supabase
async function carregarDadosSupabase() {
    try {
        mostrarMensagem('Carregando dados...', 'info');
        const dados = await SupabaseService.carregarImplantacoes();
        
        // Converter dados do Supabase para o formato esperado
        implantacoes = dados.map(item => ({
            id: item.id,
            empresa: item.empresa,
            projeto: item.projeto,
            sistema: item.sistema,
            gestor: item.gestor,
            especialista: item.especialista,
            logo: item.logo_url,
            progresso: item.progresso,
            status: item.status,
            statusMeses: item.status_meses,
            fases: item.fases,
            resumoOperacional: item.resumo_operacional,
            anoInicio: new Date(item.created_at).getFullYear() // Adicionar ano de início baseado na data de criação
        }));
        
        console.log('Dados carregados do Supabase:', implantacoes);
        
        if (implantacoes.length === 0) {
            mostrarMensagem('Nenhuma implantação encontrada. Adicione a primeira!', 'info');
        }
    } catch (error) {
        console.error('Erro ao carregar dados do Supabase:', error);
        mostrarMensagem('Erro ao carregar dados. Usando dados locais.', 'erro');
        carregarDadosLocais(); // Fallback
    }
}

// Carregar dados locais (fallback)
function carregarDadosLocais() {
    const dadosSalvos = localStorage.getItem('implantacoes');
    if (dadosSalvos) {
        implantacoes = JSON.parse(dadosSalvos);
    } else {
        // Dados de exemplo se não houver dados salvos
        implantacoes = [
            {
                id: 1,
                empresa: "Costa Verde",
                projeto: "Implantação",
                sistema: "OPTZ",
                gestor: "João Silva",
                especialista: "Maria Santos",
                logo: null,
                progresso: 85,
                status: "Em andamento",
                statusMeses: {
                    janeiro: ["concluido-prazo", "concluido-prazo", "concluido-prazo", "concluido-prazo"],
                    fevereiro: ["concluido-prazo", "concluido-prazo", "concluido-prazo", "concluido-prazo"],
                    marco: ["concluido-prazo", "concluido-prazo", "concluido-prazo", "concluido-prazo"],
                    abril: ["concluido-fora", "concluido-fora", "andamento", "andamento"],
                    maio: ["pendente", "pendente", "pendente", "pendente"],
                    junho: ["pendente", "pendente", "pendente", "pendente"],
                    julho: ["pendente", "pendente", "pendente", "pendente"],
                    agosto: ["pendente", "pendente", "pendente", "pendente"],
                    setembro: ["pendente", "pendente", "pendente", "pendente"],
                    outubro: ["pendente", "pendente", "pendente", "pendente"],
                    novembro: ["pendente", "pendente", "pendente", "pendente"],
                    dezembro: ["pendente", "pendente", "pendente", "pendente"]
                },
                fases: [
                    { nome: "Kick Off", previsto: 1, realizado: 1, status: "concluido-prazo", inicio: "2024-03-01", fim: "2024-03-01" },
                    { nome: "Treinamento", previsto: 1, realizado: 1, status: "concluido-prazo", inicio: "2024-03-15", fim: "2024-03-20" },
                    { nome: "Cadastros", previsto: 6, realizado: 6, status: "concluido-prazo", inicio: "2024-04-01", fim: "2024-04-10" },
                    { nome: "Integrações", previsto: 2, realizado: 1, status: "andamento", inicio: "2024-04-15", fim: "2024-04-25" },
                    { nome: "Testes", previsto: 1, realizado: 0, status: "pendente", inicio: "2024-05-01", fim: "2024-05-05" },
                    { nome: "Validação", previsto: 1, realizado: 0, status: "pendente", inicio: "2024-05-10", fim: "2024-05-15" },
                    { nome: "Go Live", previsto: 1, realizado: 0, status: "pendente", inicio: "2024-05-20", fim: "2024-05-20" }
                ],
                resumoOperacional: [
                    "Cliente implantado desde 04/04.",
                    "Aguardando ok do cliente para ativar o E-Check."
                ]
            }
        ];
    }
}

// Configurar event listeners
function configurarEventListeners() {
    // Botão voltar para o portal
    document.getElementById("btn-voltar-portal").addEventListener("click", function() {
        window.location.href = "https://tryvia.github.io/TryviaBI/Portal.html";
    });
    
    // Botão adicionar nova implantação
    document.getElementById('btn-adicionar').addEventListener('click', abrirModalAdicionar);
    
    // Botão voltar
    document.getElementById('btn-voltar').addEventListener('click', voltarPainelProjetos);
    
    // Botões de edição e exclusão
    document.getElementById('btn-editar-timeline').addEventListener('click', abrirModalEditarTimeline);
    document.getElementById('btn-excluir-implantacao').addEventListener('click', abrirModalConfirmarExclusao);
    
    // Modal adicionar implantação
    document.getElementById('modal-close').addEventListener('click', fecharModal);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('form-adicionar').addEventListener('submit', adicionarNovaImplantacao);
    
    // Modal editar timeline
    document.getElementById('modal-editar-close').addEventListener('click', fecharModalEditarTimeline);
    document.getElementById('btn-adicionar-fase').addEventListener('click', adicionarNovaFase);
    document.getElementById('btn-salvar-timeline').addEventListener('click', salvarAlteracoesTimeline);
    
    // Modal confirmar exclusão
    document.getElementById('modal-exclusao-close').addEventListener('click', fecharModalConfirmarExclusao);
    document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharModalConfirmarExclusao);
    document.getElementById('btn-confirmar-exclusao').addEventListener('click', excluirImplantacao);
    
    // Filtro de busca
    document.getElementById('filtro-busca').addEventListener('input', filtrarImplantacoes);
    
    // Fechar modal clicando fora
    document.getElementById('modal-adicionar').addEventListener('click', function(e) {
        if (e.target === this) {
            fecharModal();
        }
    });
    
    document.getElementById('modal-editar-timeline').addEventListener('click', function(e) {
        if (e.target === this) {
            fecharModalEditarTimeline();
        }
    });
    
    document.getElementById('modal-confirmar-exclusao').addEventListener('click', function(e) {
        if (e.target === this) {
            fecharModalConfirmarExclusao();
        }
    });
}

// Carregar painel de projetos
function carregarPainelProjetos() {
    const tbody = document.getElementById('tabela-body');
    tbody.innerHTML = '';
    
    // Filtrar implantações baseado no Go Live e Kick Off
    let implantacoesFiltradas = implantacoes.filter(implantacao => {
        return projetoDeveAparecerNoAno(implantacao, anoSelecionado);
    });
    
    implantacoesFiltradas.forEach(implantacao => {
        const row = criarLinhaImplantacao(implantacao);
        tbody.appendChild(row);
    });
    
    // Mostrar mensagem se não houver dados para o ano
    if (implantacoesFiltradas.length === 0 && implantacoes.length > 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="16" style="text-align: center; padding: 20px; color: #666;">
                Nenhuma implantação encontrada para o ano ${anoSelecionado}
            </td>
        `;
        tbody.appendChild(row);
    }
}

// Criar linha da tabela para uma implantação
function criarLinhaImplantacao(implantacao) {
    const row = document.createElement('tr');
    row.dataset.id = implantacao.id;
    
    // Obter status dos meses para o ano selecionado
    const statusMesesAno = obterStatusMesesPorAno(implantacao, anoSelecionado);
    
    // Verificar se o projeto tem Go Live concluído
    const goLiveConcluido = temGoLiveConcluido(implantacao);
    const kickOffConcluido = temKickOffConcluido(implantacao);
    const dataGoLive = getDataGoLive(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    // Adicionar classe destacado se houver atraso
    const temAtraso = Object.values(statusMesesAno).some(semanas => 
        semanas && semanas.some(status => status === 'atrasado')
    );
    if (temAtraso) {
        row.classList.add('destacado');
    }
    
    // Se Go Live concluído, adicionar classe especial
    if (goLiveConcluido) {
        row.classList.add('projeto-finalizado');
        row.style.backgroundColor = '#f0f8f0';
        row.style.borderLeft = '4px solid #4CAF50';
    }
    
    // Se projeto não iniciou (sem Kick Off), adicionar classe especial
    if (dataKickOff && !kickOffConcluido) {
        row.classList.add('projeto-nao-iniciado');
        row.style.backgroundColor = '#f8f8f0';
        row.style.borderLeft = '4px solid #FF9800';
    }
    
    // Verificar se tem Kick Off e Go Live
    const temKickOff = implantacao.fases && implantacao.fases.some(fase => 
        fase.nome.toLowerCase().includes('kick off') || fase.nome.toLowerCase().includes('kickoff')
    );
    const temGoLive = implantacao.fases && implantacao.fases.some(fase => 
        fase.nome.toLowerCase().includes('go live') || fase.nome.toLowerCase().includes('golive')
    );
    
    // Obter status do Kick Off e Go Live
    const kickOffFase = implantacao.fases && implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('kick off') || fase.nome.toLowerCase().includes('kickoff')
    );
    const goLiveFase = implantacao.fases && implantacao.fases.find(fase => 
        fase.nome.toLowerCase().includes('go live') || fase.nome.toLowerCase().includes('golive')
    );
    
    // Determinar o status do projeto
    let statusProjeto = implantacao.status;
    if (goLiveConcluido) {
        statusProjeto = "Finalizado";
    } else if (dataKickOff && !kickOffConcluido) {
        statusProjeto = "Não Iniciado";
    }
    
    // Células básicas
    row.innerHTML = `
        <td>${implantacao.empresa}</td>
        <td>${implantacao.projeto}</td>
        <td>${implantacao.sistema}</td>
        <td>${goLiveConcluido ? '100' : implantacao.progresso}%</td>
    `;
    
    // Células dos meses
    meses.forEach((mes, indexMes) => {
        const cell = document.createElement('td');
        
        // Verificar se deve mostrar "sem dados" para este mês
        if (deveExibirSemDados(implantacao, anoSelecionado, indexMes)) {
            const motivo = dataGoLive && anoSelecionado === dataGoLive.getFullYear() && indexMes > dataGoLive.getMonth() 
                ? "Projeto finalizado - sem dados"
                : "Projeto não iniciado - sem dados";
            
            cell.innerHTML = '<div class="sem-dados" title="' + motivo + '">-</div>';
            cell.style.textAlign = 'center';
            cell.style.color = '#999';
            cell.style.fontStyle = 'italic';
        } else {
            const statusSemanas = statusMesesAno[mes] || ["pendente", "pendente", "pendente", "pendente"];
            
            // Agrupar status consecutivos iguais
            const gruposStatus = agruparStatusConsecutivos(statusSemanas);
            
            gruposStatus.forEach(grupo => {
                const statusBar = document.createElement('div');
                statusBar.className = `status-bar status-${grupo.status}`;
                statusBar.style.width = `${(grupo.quantidade / statusSemanas.length) * 100}%`;
                statusBar.title = `${nomesMeses[meses.indexOf(mes)]} ${anoSelecionado}: ${grupo.status.replace('-', ' ')} (${grupo.quantidade} semana${grupo.quantidade > 1 ? 's' : ''})`;
                cell.appendChild(statusBar);
            });
            
            // Adicionar ícones de Kick Off e Go Live se a fase ocorrer neste mês
            if (implantacao.fases) {
                implantacao.fases.forEach(fase => {
                    const faseNomeLower = fase.nome.toLowerCase();
                    const isKickOff = faseNomeLower.includes('kick off') || faseNomeLower.includes('kickoff');
                    const isGoLive = faseNomeLower.includes('go live') || faseNomeLower.includes('golive');

                    if ((isKickOff || isGoLive) && fase.inicio && fase.fim) {
                        const dataInicio = new Date(fase.inicio);
                        const dataFim = new Date(fase.fim);
                        const mesFaseInicio = dataInicio.getMonth();
                        const mesFaseFim = dataFim.getMonth();
                        const anoFaseInicio = dataInicio.getFullYear();
                        const anoFaseFim = dataFim.getFullYear();

                        // Verificar se a fase ocorre no mês e ano atual da iteração
                        if (anoFaseInicio <= anoSelecionado && anoFaseFim >= anoSelecionado &&
                            indexMes >= mesFaseInicio && indexMes <= mesFaseFim) {
                            
                            const icone = document.createElement('span');
                            icone.className = `icone-fase ${isKickOff ? 'icone-inicio' : 'icone-golive'} ${fase.status === 'concluido-prazo' ? 'concluido' : fase.status === 'andamento' ? 'andamento' : 'pendente'}`;
                            icone.title = `${fase.nome}: ${fase.status.replace('-', ' ')}`;
                            icone.textContent = isKickOff ? '📍' : '🏴';
                            
                            // Se é Go Live concluído, destacar com cor especial
                            if (isGoLive && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora')) {
                                icone.style.color = '#4CAF50';
                                icone.style.fontSize = '16px';
                                icone.title += ' - PROJETO FINALIZADO';
                            }
                            
                            // Se é Kick Off concluído, destacar
                            if (isKickOff && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora')) {
                                icone.style.color = '#2196F3';
                                icone.style.fontSize = '16px';
                                icone.title += ' - PROJETO INICIADO';
                            }
                            
                            cell.appendChild(icone);
                        }
                    }
                });
            }
        }
        
        row.appendChild(cell);
    });
    
    // Event listener para clique na linha
    row.addEventListener('click', () => exibirStatusImplantacao(implantacao));
    
    return row;
}

// Obter status dos meses para um ano específico
function obterStatusMesesPorAno(implantacao, ano) {
    // Verificar se deve mostrar "sem dados" para todo o ano
    const dataGoLive = getDataGoLive(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    // Se ano posterior ao Go Live, todos os meses são "sem dados"
    if (dataGoLive && ano > dataGoLive.getFullYear()) {
        const statusSemDados = {};
        meses.forEach(mes => {
            statusSemDados[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
        });
        return statusSemDados;
    }
    
    // Se ano anterior ao Kick Off, todos os meses são "sem dados"
    if (dataKickOff && ano < dataKickOff.getFullYear()) {
        const statusSemDados = {};
        meses.forEach(mes => {
            statusSemDados[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
        });
        return statusSemDados;
    }
    
    // Se existe dados específicos para o ano
    if (implantacao.statusMeses && implantacao.statusMeses[ano]) {
        const statusAno = implantacao.statusMeses[ano];
        
        // Aplicar limitações do Kick Off e Go Live no mesmo ano
        if ((dataKickOff && ano === dataKickOff.getFullYear()) || (dataGoLive && ano === dataGoLive.getFullYear())) {
            const mesKickOff = dataKickOff ? dataKickOff.getMonth() : -1;
            const mesGoLive = dataGoLive ? dataGoLive.getMonth() : 12;
            const statusLimitado = {};
            
            meses.forEach((mes, index) => {
                if (index < mesKickOff || index > mesGoLive) {
                    statusLimitado[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
                } else {
                    statusLimitado[mes] = statusAno[mes] || ["pendente", "pendente", "pendente", "pendente"];
                }
            });
            
            return statusLimitado;
        }
        
        return statusAno;
    }
    
    // Se existe o formato antigo (sem separação por ano)
    if (implantacao.statusMeses && !implantacao.statusMeses[ano] && typeof implantacao.statusMeses.janeiro !== 'undefined') {
        // Assumir que os dados são do ano atual ou ano de início
        if (ano === new Date().getFullYear() || ano === implantacao.anoInicio) {
            const statusAntigo = implantacao.statusMeses;
            
            // Aplicar limitações do Kick Off e Go Live
            if ((dataKickOff && ano === dataKickOff.getFullYear()) || (dataGoLive && ano === dataGoLive.getFullYear())) {
                const mesKickOff = dataKickOff ? dataKickOff.getMonth() : -1;
                const mesGoLive = dataGoLive ? dataGoLive.getMonth() : 12;
                const statusLimitado = {};
                
                meses.forEach((mes, index) => {
                    if (index < mesKickOff || index > mesGoLive) {
                        statusLimitado[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
                    } else {
                        statusLimitado[mes] = statusAntigo[mes] || ["pendente", "pendente", "pendente", "pendente"];
                    }
                });
                
                return statusLimitado;
            }
            
            return statusAntigo;
        }
    }
    
    // Gerar status baseado nas fases para o ano específico
    return gerarStatusMesesPorFases(implantacao, ano);
}

// Gerar status dos meses baseado nas fases
function gerarStatusMesesPorFases(implantacao, ano) {
    const statusMeses = {};
    
    // Inicializar todos os meses como pendente
    meses.forEach(mes => {
        statusMeses[mes] = ["pendente", "pendente", "pendente", "pendente"];
    });
    
    if (!implantacao.fases) return statusMeses;
    
    // Verificar limitações do Kick Off e Go Live
    const dataKickOff = getDataKickOff(implantacao);
    const dataGoLive = getDataGoLive(implantacao);
    
    let mesInicial = 0; // Janeiro por padrão
    let mesFinal = 11; // Dezembro por padrão
    
    // Limitar início baseado no Kick Off
    if (dataKickOff && ano === dataKickOff.getFullYear()) {
        mesInicial = dataKickOff.getMonth();
    } else if (dataKickOff && ano < dataKickOff.getFullYear()) {
        // Se o ano é anterior ao Kick Off, todos os meses são "sem dados"
        meses.forEach(mes => {
            statusMeses[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
        });
        return statusMeses;
    }
    
    // Limitar fim baseado no Go Live
    if (dataGoLive && ano === dataGoLive.getFullYear()) {
        mesFinal = dataGoLive.getMonth();
    } else if (dataGoLive && ano > dataGoLive.getFullYear()) {
        // Se o ano é posterior ao Go Live, todos os meses são "sem dados"
        meses.forEach(mes => {
            statusMeses[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
        });
        return statusMeses;
    }
    
    // Marcar meses fora do período como "sem dados"
    meses.forEach((mes, index) => {
        if (index < mesInicial || index > mesFinal) {
            statusMeses[mes] = ["sem-dados", "sem-dados", "sem-dados", "sem-dados"];
        }
    });
    
    // Aplicar status das fases aos meses válidos
    implantacao.fases.forEach(fase => {
        if (fase.inicio && fase.fim) {
            const dataInicio = new Date(fase.inicio);
            const dataFim = new Date(fase.fim);
            const anoInicio = dataInicio.getFullYear();
            const anoFim = dataFim.getFullYear();
            
            // Verificar se a fase ocorre no ano especificado
            if (anoInicio <= ano && anoFim >= ano) {
                const mesInicioFase = anoInicio === ano ? dataInicio.getMonth() : 0;
                const mesFimFase = anoFim === ano ? dataFim.getMonth() : 11;
                
                // Aplicar o status da fase aos meses correspondentes, respeitando os limites
                for (let mes = Math.max(mesInicioFase, mesInicial); mes <= Math.min(mesFimFase, mesFinal); mes++) {
                    const nomeMes = meses[mes];
                    statusMeses[nomeMes] = [fase.status, fase.status, fase.status, fase.status];
                }
            }
        }
    });
    
    return statusMeses;
}

// Exibir status de implantação
function exibirStatusImplantacao(implantacao) {
    implantacaoAtual = implantacao;
    
    // Verificar se o projeto está finalizado ou não iniciado
    const goLiveConcluido = temGoLiveConcluido(implantacao);
    const kickOffConcluido = temKickOffConcluido(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    document.getElementById('painel-projetos').classList.add('hidden');
    document.getElementById('status-implantacao').classList.remove('hidden');
    
    // Preencher dados da empresa
    const empresaDados = document.getElementById('empresa-dados');
    empresaDados.innerHTML = `
        <td>${implantacao.empresa}</td>
        <td>${implantacao.sistema}</td>
        <td>${implantacao.gestor}</td>
        <td>${implantacao.especialista}</td>
    `;
    
    // Configurar logo
    const logoImg = document.getElementById('logo-img');
    const logoText = document.getElementById('logo-text');
    
    if (implantacao.logo) {
        logoImg.src = implantacao.logo;
        logoImg.style.display = 'block';
        logoText.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        logoText.style.display = 'block';
        logoText.textContent = implantacao.empresa.substring(0, 3).toUpperCase();
    }
    
    // Atualizar progresso
    let progressoFinal = implantacao.progresso;
    if (goLiveConcluido) {
        progressoFinal = 100;
    } else if (dataKickOff && !kickOffConcluido) {
        progressoFinal = 0;
    }
    atualizarBarraProgresso(progressoFinal);
    
    // Carregar timeline detalhada
    carregarTimelineDetalhada(implantacao);
    
    // Preencher resumo e status
    preencherResumoStatus(implantacao);
    
    // Adicionar indicações visuais baseado no status
    const headerContent = document.querySelector('.header-content h1');
    
    // Remover badges anteriores
    const badgeAnterior = headerContent.querySelector('.projeto-status-badge');
    if (badgeAnterior) {
        badgeAnterior.remove();
    }
    
    if (goLiveConcluido) {
        const statusBadge = document.getElementById('status-badge');
        statusBadge.textContent = 'Finalizado';
        statusBadge.className = 'status-badge status-finalizado';
        statusBadge.style.backgroundColor = '#4CAF50';
        statusBadge.style.color = 'white';
        
        // Adicionar badge de projeto finalizado
        const badge = document.createElement('span');
        badge.className = 'projeto-status-badge';
        badge.textContent = '✅ FINALIZADO';
        badge.style.cssText = `
            background: #4CAF50;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
            font-weight: bold;
        `;
        headerContent.appendChild(badge);
    } else if (dataKickOff && !kickOffConcluido) {
        const statusBadge = document.getElementById('status-badge');
        statusBadge.textContent = 'Não Iniciado';
        statusBadge.className = 'status-badge status-nao-iniciado';
        statusBadge.style.backgroundColor = '#FF9800';
        statusBadge.style.color = 'white';
        
        // Adicionar badge de projeto não iniciado
        const badge = document.createElement('span');
        badge.className = 'projeto-status-badge';
        badge.textContent = '⏳ NÃO INICIADO';
        badge.style.cssText = `
            background: #FF9800;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
            font-weight: bold;
        `;
        headerContent.appendChild(badge);
    }
}

// Atualizar barra de progresso
function atualizarBarraProgresso(progresso) {
    const progressoFill = document.getElementById('progresso-fill');
    const progressoTexto = document.getElementById('progresso-texto');
    
    progressoFill.style.width = `${progresso}%`;
    progressoTexto.textContent = `${progresso}%`;
    
    // Alterar cor baseado no progresso
    if (progresso === 100) {
        progressoFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
    } else if (progresso === 0) {
        progressoFill.style.background = 'linear-gradient(90deg, #FF9800, #F57C00)';
    } else if (progresso >= 75) {
        progressoFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
    } else if (progresso >= 50) {
        progressoFill.style.background = 'linear-gradient(90deg, #FF9800, #F57C00)';
    } else {
        progressoFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
    }
}

// Recalcular progresso baseado nas fases
function recalcularProgresso() {
    if (!implantacaoAtual) return;
    
    let totalPrevisto = 0;
    let totalRealizado = 0;
    
    implantacaoAtual.fases.forEach(fase => {
        totalPrevisto += parseInt(fase.previsto) || 0;
        totalRealizado += parseInt(fase.realizado) || 0;
    });
    
    let novoProgresso = 0;
    if (totalPrevisto > 0) {
        novoProgresso = Math.round((totalRealizado / totalPrevisto) * 100);
    }
    
    // Se Go Live está concluído, progresso é sempre 100%
    if (temGoLiveConcluido(implantacaoAtual)) {
        novoProgresso = 100;
    }
    // Se Kick Off não foi concluído, progresso é 0%
    else if (getDataKickOff(implantacaoAtual) && !temKickOffConcluido(implantacaoAtual)) {
        novoProgresso = 0;
    }
    
    implantacaoAtual.progresso = novoProgresso;
    atualizarBarraProgresso(novoProgresso);
}

// Atualizar status dos meses baseado nas fases
function atualizarStatusMeses() {
    if (!implantacaoAtual) return;
    
    const anoAtual = new Date().getFullYear();
    const statusMesesAtualizado = gerarStatusMesesPorFases(implantacaoAtual, anoAtual);
    
    // Atualizar ou criar estrutura de anos
    if (!implantacaoAtual.statusMeses) {
        implantacaoAtual.statusMeses = {};
    }
    
    implantacaoAtual.statusMeses[anoAtual] = statusMesesAtualizado;
    
    // Atualizar status geral baseado no estado do projeto
    if (temGoLiveConcluido(implantacaoAtual)) {
        implantacaoAtual.status = "Finalizado";
    } else if (getDataKickOff(implantacaoAtual) && !temKickOffConcluido(implantacaoAtual)) {
        implantacaoAtual.status = "Não Iniciado";
    } else {
        implantacaoAtual.status = "Em andamento";
    }
}

// Carregar timeline detalhada
function carregarTimelineDetalhada(implantacao) {
    const timelineBody = document.getElementById('timeline-body');
    timelineBody.innerHTML = '';
    
    if (!implantacao.fases || implantacao.fases.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="100%">Nenhuma fase definida</td>';
        timelineBody.appendChild(row);
        return;
    }
    
    // Verificar se o projeto está finalizado ou não iniciado
    const goLiveConcluido = temGoLiveConcluido(implantacao);
    const kickOffConcluido = temKickOffConcluido(implantacao);
    const dataGoLive = getDataGoLive(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    
    // Calcular intervalo de datas
    let minDate = null;
    let maxDate = null;
    
    implantacao.fases.forEach(fase => {
        if (fase.inicio && fase.fim) {
            const inicio = new Date(fase.inicio + "T00:00:00");
            const fim = new Date(fase.fim + "T00:00:00");
            
            if (!minDate || inicio < minDate) minDate = inicio;
            if (!maxDate || fim > maxDate) maxDate = fim;
        }
    });
    
    if (!minDate || !maxDate) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="100%">Datas das fases não definidas</td>';
        timelineBody.appendChild(row);
        return;
    }
    
    // Se projeto finalizado, limitar maxDate até a data do Go Live
    if (dataGoLive && dataGoLive < maxDate) {
        maxDate = dataGoLive;
    }
    
    const totalDias = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Atualizar cabeçalho dos dias
    atualizarCabecalhoDias(minDate, maxDate);
    
    // Criar linhas para cada fase
    implantacao.fases.forEach(fase => {
        const row = document.createElement("tr");
        
        // Célula da fase
        const faseCell = document.createElement("td");
        faseCell.className = "fase-nome";
        faseCell.textContent = fase.nome;
        
        // Destacar fases especiais
        const faseNomeLower = fase.nome.toLowerCase();
        const isKickOff = faseNomeLower.includes('kick off') || faseNomeLower.includes('kickoff');
        const isGoLive = faseNomeLower.includes('go live') || faseNomeLower.includes('golive');
        
        if (isGoLive && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora')) {
            faseCell.style.fontWeight = 'bold';
            faseCell.style.color = '#4CAF50';
            faseCell.innerHTML += ' ✅';
        } else if (isKickOff && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora')) {
            faseCell.style.fontWeight = 'bold';
            faseCell.style.color = '#2196F3';
            faseCell.innerHTML += ' 📍';
        }
        
        row.appendChild(faseCell);

        // Célula do previsto
        const previstoCell = document.createElement("td");
        previstoCell.className = "previsto-nome";
        previstoCell.textContent = fase.previsto;
        row.appendChild(previstoCell);

        // Célula do realizado
        const realizadoCell = document.createElement("td");
        realizadoCell.className = "realizado-nome";
        realizadoCell.textContent = fase.realizado;
        row.appendChild(realizadoCell);

        // Células dos dias
        const timelineCells = [];
        for (let i = 0; i < totalDias; i++) {
            timelineCells.push(document.createElement("td"));
        }

        if (fase.inicio && fase.fim) {
            const dataInicioFase = new Date(fase.inicio + "T00:00:00");
            const dataFimFase = new Date(fase.fim + "T00:00:00");

            const startIndex = Math.max(0, Math.floor((dataInicioFase - minDate) / (1000 * 60 * 60 * 24)));
            const endIndex = Math.min(totalDias - 1, Math.floor((dataFimFase - minDate) / (1000 * 60 * 60 * 24)));
            const duration = endIndex - startIndex + 1;

            if (duration > 0) {
                const statusBar = document.createElement("div");
                statusBar.className = `status-bar status-${fase.status}`;
                statusBar.style.width = `calc(${duration} * var(--day-cell-width) + ${duration - 1} * var(--day-cell-spacing))`;
                statusBar.style.position = "absolute";
                statusBar.style.left = `calc(${startIndex} * var(--day-cell-width) + ${startIndex} * var(--day-cell-spacing))`;
                statusBar.style.height = "25px";
                statusBar.style.top = "50%";
                statusBar.style.transform = "translateY(-50%)";
                statusBar.style.borderRadius = "12px";
                statusBar.style.display = "flex";
                statusBar.style.alignItems = "center";
                statusBar.style.justifyContent = "center";
                statusBar.style.color = "white";
                statusBar.style.fontSize = "12px";
                statusBar.style.fontWeight = "bold";
                statusBar.textContent = fase.nome;

                // Adicionar marcadores especiais
                if (isKickOff) {
                    statusBar.innerHTML = "⭐";
                    statusBar.className += " tooltip";
                    statusBar.setAttribute("data-tooltip", "Reunião de alinhamento");
                    
                    if (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora') {
                        statusBar.innerHTML = "⭐📍";
                        statusBar.setAttribute("data-tooltip", "Kick Off - PROJETO INICIADO");
                        statusBar.style.backgroundColor = "#2196F3";
                    }
                } else if (isGoLive) {
                    statusBar.innerHTML = "🏴";
                    statusBar.className += " tooltip";
                    statusBar.setAttribute("data-tooltip", "Go Live");
                    
                    if (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora') {
                        statusBar.innerHTML = "🏴✅";
                        statusBar.setAttribute("data-tooltip", "Go Live - PROJETO FINALIZADO");
                        statusBar.style.backgroundColor = "#4CAF50";
                    }
                }

                timelineCells[0].style.position = "relative";
                timelineCells[0].appendChild(statusBar);
            }
        }

        timelineCells.forEach(cell => row.appendChild(cell));
        timelineBody.appendChild(row);
    });
}

// Atualizar cabeçalho dos dias dinamicamente
function atualizarCabecalhoDias(minDate, maxDate) {
    const diasHeader = document.getElementById("dias-header");
    const mesesHeader = document.getElementById("meses-header");
    diasHeader.innerHTML = "<th></th><th></th><th></th>"; // Células vazias para fase, previsto, realizado
    mesesHeader.innerHTML = "<th></th><th></th><th></th>"; // Células vazias para fase, previsto, realizado

    let currentMonth = new Date(minDate);
    let monthColspan = 0;

    while (currentMonth <= maxDate) {
        const monthName = nomesMeses[currentMonth.getMonth()];
        const daysInMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            0
        ).getDate();

        let startDay = 1;
        let endDay = daysInMonth;

        if (currentMonth.getMonth() === minDate.getMonth() && currentMonth.getFullYear() === minDate.getFullYear()) {
            startDay = minDate.getDate();
        }
        if (currentMonth.getMonth() === maxDate.getMonth() && currentMonth.getFullYear() === maxDate.getFullYear()) {
            endDay = maxDate.getDate();
        }
        
        const currentMonthDays = endDay - startDay + 1;
        monthColspan += currentMonthDays;

        const thMonth = document.createElement("th");
        thMonth.setAttribute("colspan", currentMonthDays);
        thMonth.textContent = monthName;
        mesesHeader.appendChild(thMonth);

        for (let i = startDay; i <= endDay; i++) {
            const thDay = document.createElement("th");
            thDay.textContent = i;
            diasHeader.appendChild(thDay);
        }

        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
}

// Preencher resumo operacional e status
function preencherResumoStatus(implantacao) {
    const resumoConteudo = document.getElementById('resumo-conteudo');
    resumoConteudo.innerHTML = '';
    
    // Verificar status do projeto
    const goLiveConcluido = temGoLiveConcluido(implantacao);
    const kickOffConcluido = temKickOffConcluido(implantacao);
    const dataKickOff = getDataKickOff(implantacao);
    const projetoNaoIniciado = dataKickOff && !kickOffConcluido;
    
    // Adicionar mensagem especial baseado no status
    if (goLiveConcluido) {
        const mensagemFinalizado = document.createElement('div');
        mensagemFinalizado.style.cssText = `
            background: #e8f5e8;
            border: 2px solid #4CAF50;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
        `;
        mensagemFinalizado.innerHTML = `
            <h4 style="color: #4CAF50; margin: 0 0 10px 0;">🎉 PROJETO FINALIZADO</h4>
            <p style="margin: 0; color: #2e7d32;">O Go Live foi concluído com sucesso. Este projeto está finalizado.</p>
        `;
        resumoConteudo.appendChild(mensagemFinalizado);
    } else if (projetoNaoIniciado) {
        const mensagemNaoIniciado = document.createElement('div');
        mensagemNaoIniciado.style.cssText = `
            background: #fff3e0;
            border: 2px solid #FF9800;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
        `;
        mensagemNaoIniciado.innerHTML = `
            <h4 style="color: #FF9800; margin: 0 0 10px 0;">⏳ PROJETO NÃO INICIADO</h4>
            <p style="margin: 0; color: #e65100;">O Kick Off ainda não foi realizado. O projeto aguarda início.</p>
        `;
        resumoConteudo.appendChild(mensagemNaoIniciado);
    }
    
    // Criar container para as frases editáveis
    const frasesContainer = document.createElement('div');
    frasesContainer.id = 'frases-container';
    
    implantacao.resumoOperacional.forEach((item, index) => {
        const fraseDiv = document.createElement('div');
        fraseDiv.className = 'frase-item';
        fraseDiv.style.marginBottom = '15px';
        fraseDiv.style.padding = '10px';
        fraseDiv.style.border = '1px solid #e0e0e0';
        fraseDiv.style.borderRadius = '5px';
        fraseDiv.style.backgroundColor = '#f9f9f9';
        
        const fraseTexto = document.createElement('p');
        fraseTexto.textContent = `• ${item}`;
        fraseTexto.style.marginBottom = '8px';
        fraseTexto.style.cursor = goLiveConcluido ? 'default' : 'pointer';
        fraseTexto.title = goLiveConcluido ? 'Projeto finalizado - edição desabilitada' : 'Clique para editar';
        
        if (goLiveConcluido) {
            fraseTexto.style.color = '#666';
        }
        
        const fraseInput = document.createElement('textarea');
        fraseInput.value = item;
        fraseInput.style.width = '100%';
        fraseInput.style.minHeight = '60px';
        fraseInput.style.display = 'none';
        fraseInput.style.border = '1px solid #ccc';
        fraseInput.style.borderRadius = '3px';
        fraseInput.style.padding = '5px';
        fraseInput.style.fontSize = '14px';
        fraseInput.style.resize = 'vertical';
        fraseInput.disabled = goLiveConcluido;
        
        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'none';
        botoesDiv.style.marginTop = '8px';
        
        const btnSalvar = document.createElement('button');
        btnSalvar.textContent = 'Salvar';
        btnSalvar.style.marginRight = '8px';
        btnSalvar.style.padding = '5px 12px';
        btnSalvar.style.backgroundColor = '#4CAF50';
        btnSalvar.style.color = 'white';
        btnSalvar.style.border = 'none';
        btnSalvar.style.borderRadius = '3px';
        btnSalvar.style.cursor = 'pointer';
        btnSalvar.disabled = goLiveConcluido;
        
        const btnCancelar = document.createElement('button');
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.style.padding = '5px 12px';
        btnCancelar.style.backgroundColor = '#f44336';
        btnCancelar.style.color = 'white';
        btnCancelar.style.border = 'none';
        btnCancelar.style.borderRadius = '3px';
        btnCancelar.style.cursor = 'pointer';
        
        const btnRemover = document.createElement('button');
        btnRemover.textContent = '🗑️';
        btnRemover.title = goLiveConcluido ? 'Projeto finalizado - edição desabilitada' : 'Remover observação';
        btnRemover.style.padding = '5px 8px';
        btnRemover.style.backgroundColor = goLiveConcluido ? '#ccc' : '#ff9800';
        btnRemover.style.color = 'white';
        btnRemover.style.border = 'none';
        btnRemover.style.borderRadius = '3px';
        btnRemover.style.cursor = goLiveConcluido ? 'not-allowed' : 'pointer';
        btnRemover.style.marginLeft = '8px';
        btnRemover.style.fontSize = '12px';
        btnRemover.disabled = goLiveConcluido;
        
        // Event listeners para edição (só se projeto não finalizado)
        if (!goLiveConcluido) {
            fraseTexto.addEventListener('click', () => {
                fraseTexto.style.display = 'none';
                fraseInput.style.display = 'block';
                botoesDiv.style.display = 'block';
                fraseInput.focus();
            });
            
            btnSalvar.addEventListener('click', async () => {
                const novoTexto = fraseInput.value.trim();
                if (novoTexto) {
                    implantacaoAtual.resumoOperacional[index] = novoTexto;
                    fraseTexto.textContent = `• ${novoTexto}`;
                    
                    try {
                        // Salvar no Supabase
                        await SupabaseService.atualizarImplantacao(implantacaoAtual.id, implantacaoAtual);
                        
                        // Atualizar na lista local
                        const indexImplantacao = implantacoes.findIndex(imp => imp.id === implantacaoAtual.id);
                        if (indexImplantacao !== -1) {
                            implantacoes[indexImplantacao] = { ...implantacaoAtual };
                        }
                        
                        mostrarMensagem('Observação atualizada com sucesso!', 'sucesso');
                    } catch (error) {
                        console.error('Erro ao salvar observação:', error);
                        mostrarMensagem('Erro ao salvar observação. Tente novamente.', 'erro');
                    }
                }
                
                fraseTexto.style.display = 'block';
                fraseInput.style.display = 'none';
                botoesDiv.style.display = 'none';
            });
            
            btnCancelar.addEventListener('click', () => {
                fraseInput.value = implantacaoAtual.resumoOperacional[index];
                fraseTexto.style.display = 'block';
                fraseInput.style.display = 'none';
                botoesDiv.style.display = 'none';
            });
            
            btnRemover.addEventListener('click', () => {
                removerObservacao(index);
            });
        }
        
        botoesDiv.appendChild(btnSalvar);
        botoesDiv.appendChild(btnCancelar);
        botoesDiv.appendChild(btnRemover);
        
        fraseDiv.appendChild(fraseTexto);
        fraseDiv.appendChild(fraseInput);
        fraseDiv.appendChild(botoesDiv);
        
        frasesContainer.appendChild(fraseDiv);
    });
    
    // Botão para adicionar nova frase (só se projeto não finalizado)
    if (!goLiveConcluido) {
        const btnAdicionarFrase = document.createElement('button');
        btnAdicionarFrase.textContent = '+ Adicionar Nova Observação';
        btnAdicionarFrase.style.padding = '10px 15px';
        btnAdicionarFrase.style.backgroundColor = '#2196F3';
        btnAdicionarFrase.style.color = 'white';
        btnAdicionarFrase.style.border = 'none';
        btnAdicionarFrase.style.borderRadius = '5px';
        btnAdicionarFrase.style.cursor = 'pointer';
        btnAdicionarFrase.style.marginTop = '15px';
        
        btnAdicionarFrase.addEventListener('click', () => {
            adicionarNovaObservacao();
        });
        
        resumoConteudo.appendChild(frasesContainer);
        resumoConteudo.appendChild(btnAdicionarFrase);
    } else {
        resumoConteudo.appendChild(frasesContainer);
    }
    
    const statusBadge = document.getElementById('status-badge');
    let statusFinal = implantacao.status;
    
    if (goLiveConcluido) {
        statusFinal = 'Finalizado';
    } else if (projetoNaoIniciado) {
        statusFinal = 'Não Iniciado';
    }
    
    statusBadge.textContent = statusFinal;
    statusBadge.className = 'status-badge';
    
    switch (statusFinal.toLowerCase()) {
        case 'finalizado':
            statusBadge.classList.add('status-finalizado');
            statusBadge.style.backgroundColor = '#4CAF50';
            statusBadge.style.color = 'white';
            break;
        case 'não iniciado':
            statusBadge.classList.add('status-nao-iniciado');
            statusBadge.style.backgroundColor = '#FF9800';
            statusBadge.style.color = 'white';
            break;
        case 'em andamento':
            statusBadge.classList.add('status-em-andamento');
            break;
        case 'atrasado':
            statusBadge.classList.add('status-atrasado');
            break;
    }
}

// Abrir modal para editar timeline
function abrirModalEditarTimeline() {
    if (!implantacaoAtual) return;
    
    // Verificar se projeto está finalizado
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível editar a timeline de um projeto finalizado!', 'erro');
        return;
    }
    
    document.getElementById('modal-empresa-nome').textContent = implantacaoAtual.empresa;
    document.getElementById('modal-editar-timeline').classList.remove('hidden');
    
    carregarFasesEditor();
}

// Fechar modal de editar timeline
function fecharModalEditarTimeline() {
    document.getElementById('modal-editar-timeline').classList.add('hidden');
}

// Carregar fases no editor
function carregarFasesEditor() {
    const fasesEditor = document.getElementById('fases-editor');
    fasesEditor.innerHTML = '';
    
    const goLiveConcluido = temGoLiveConcluido(implantacaoAtual);
    
    implantacaoAtual.fases.forEach((fase, index) => {
        const faseItem = criarItemFaseEditor(fase, index, goLiveConcluido);
        fasesEditor.appendChild(faseItem);
    });
}

// Criar item de fase no editor
function criarItemFaseEditor(fase, index, projetoFinalizado = false) {
    const faseDiv = document.createElement('div');
    faseDiv.className = 'fase-item';
    faseDiv.dataset.index = index;
    
    const faseNomeLower = fase.nome.toLowerCase();
    const isKickOff = faseNomeLower.includes('kick off') || faseNomeLower.includes('kickoff');
    const isGoLive = faseNomeLower.includes('go live') || faseNomeLower.includes('golive');
    const kickOffConcluido = isKickOff && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora');
    const goLiveConcluido = isGoLive && (fase.status === 'concluido-prazo' || fase.status === 'concluido-fora');
    
    faseDiv.innerHTML = `
        <div class="fase-header">
            <div class="fase-titulo">
                Fase ${index + 1}
                ${kickOffConcluido ? ' 📍 INICIADO' : ''}
                ${goLiveConcluido ? ' ✅ FINALIZADO' : ''}
            </div>
            <div class="fase-actions">
                <button type="button" class="btn-fase-action btn-remover-fase" onclick="removerFase(${index})" 
                    ${projetoFinalizado ? 'disabled title="Projeto finalizado - edição desabilitada"' : ''}>
                    🗑️ Remover
                </button>
            </div>
        </div>
        <div class="fase-form">
            <div class="form-field">
                <label>Nome da Fase</label>
                <input type="text" value="${fase.nome}" data-field="nome" 
                    ${projetoFinalizado ? 'disabled' : ''}>
            </div>
            <div class="form-field">
                <label>Previsto</label>
                <input type="number" value="${fase.previsto}" data-field="previsto" min="0" 
                    ${projetoFinalizado ? 'disabled' : ''}>
            </div>
            <div class="form-field">
                <label>Realizado</label>
                <input type="number" value="${fase.realizado}" data-field="realizado" min="0" 
                    onchange="atualizarProgressoEmTempoReal()" 
                    ${projetoFinalizado ? 'disabled' : ''}>
            </div>
            <div class="form-field">
                <label>Status</label>
                <select data-field="status" ${projetoFinalizado ? 'disabled' : ''}>
                    <option value="pendente" ${fase.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="andamento" ${fase.status === 'andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="concluido-prazo" ${fase.status === 'concluido-prazo' ? 'selected' : ''}>Concluído no Prazo</option>
                    <option value="concluido-fora" ${fase.status === 'concluido-fora' ? 'selected' : ''}>Concluído Fora do Prazo</option>
                    <option value="atrasado" ${fase.status === 'atrasado' ? 'selected' : ''}>Atrasado</option>
                </select>
            </div>
            <div class="form-field">
                <label>Data Início</label>
                <input type="date" value="${fase.inicio}" data-field="inicio" 
                    ${projetoFinalizado ? 'disabled' : ''}>
            </div>
            <div class="form-field">
                <label>Data Fim</label>
                <input type="date" value="${fase.fim}" data-field="fim" 
                    ${projetoFinalizado ? 'disabled' : ''}>
            </div>
        </div>
    `;
    
    // Destacar visualmente fases especiais
    if (kickOffConcluido) {
        faseDiv.style.backgroundColor = '#e3f2fd';
        faseDiv.style.border = '2px solid #2196F3';
    } else if (goLiveConcluido) {
        faseDiv.style.backgroundColor = '#e8f5e8';
        faseDiv.style.border = '2px solid #4CAF50';
    }
    
    return faseDiv;
}

// Adicionar nova fase
function adicionarNovaFase() {
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível adicionar fases a um projeto finalizado!', 'erro');
        return;
    }
    
    const novaFase = {
        nome: "Nova Fase",
        previsto: 1,
        realizado: 0,
        status: "pendente",
        inicio: "",
        fim: ""
    };
    
    implantacaoAtual.fases.push(novaFase);
    carregarFasesEditor();
    mostrarMensagem('Nova fase adicionada!', 'sucesso');
}

// Remover fase
function removerFase(index) {
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível remover fases de um projeto finalizado!', 'erro');
        return;
    }
    
    if (implantacaoAtual.fases.length <= 1) {
        mostrarMensagem('Não é possível remover a última fase!', 'erro');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover esta fase?')) {
        implantacaoAtual.fases.splice(index, 1);
        carregarFasesEditor();
        mostrarMensagem('Fase removida com sucesso!', 'sucesso');
    }
}

// Salvar alterações da timeline
async function salvarAlteracoesTimeline() {
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível editar a timeline de um projeto finalizado!', 'erro');
        return;
    }
    
    const fasesItems = document.querySelectorAll('.fase-item');
    
    fasesItems.forEach((item, index) => {
        const fase = implantacaoAtual.fases[index];
        if (!fase) return;
        
        const inputs = item.querySelectorAll('[data-field]');
        inputs.forEach(input => {
            const field = input.dataset.field;
            fase[field] = input.value;
        });
    });
    
    // Recalcular progresso baseado nas fases
    recalcularProgresso();
    
    // Atualizar status dos meses baseado nas fases
    atualizarStatusMeses();
    
    try {
        mostrarMensagem('Salvando alterações...', 'info');
        
        // Salvar no Supabase
        await SupabaseService.atualizarImplantacao(implantacaoAtual.id, implantacaoAtual);
        
        // Atualizar na lista local
        const index = implantacoes.findIndex(imp => imp.id === implantacaoAtual.id);
        if (index !== -1) {
            implantacoes[index] = { ...implantacaoAtual };
        }
        
        // Recarregar interfaces
        carregarPainelProjetos();
        carregarTimelineDetalhada(implantacaoAtual);
        atualizarBarraProgresso(implantacaoAtual.progresso);
        preencherResumoStatus(implantacaoAtual);
        
        fecharModalEditarTimeline();
        mostrarMensagem('Timeline atualizada com sucesso!', 'sucesso');
        
        // Verificar mudanças de status importantes
        if (temGoLiveConcluido(implantacaoAtual)) {
            mostrarMensagem('🎉 Parabéns! O Go Live foi concluído. O projeto está finalizado!', 'sucesso');
        } else if (temKickOffConcluido(implantacaoAtual)) {
            mostrarMensagem('🚀 Kick Off concluído! O projeto foi iniciado oficialmente.', 'sucesso');
        }
        
        // Recarregar a página de status para mostrar as mudanças
        setTimeout(() => {
            exibirStatusImplantacao(implantacaoAtual);
        }, 1000);
        
    } catch (error) {
        console.error('Erro ao salvar timeline:', error);
        mostrarMensagem('Erro ao salvar alterações. Tente novamente.', 'erro');
    }
}

// Abrir modal para confirmar exclusão
function abrirModalConfirmarExclusao() {
    if (!implantacaoAtual) return;
    
    document.getElementById('exclusao-empresa-nome').textContent = implantacaoAtual.empresa;
    document.getElementById('modal-confirmar-exclusao').classList.remove('hidden');
}

// Fechar modal de confirmar exclusão
function fecharModalConfirmarExclusao() {
    document.getElementById('modal-confirmar-exclusao').classList.add('hidden');
}

// Excluir implantação
async function excluirImplantacao() {
    if (!implantacaoAtual) return;
    
    try {
        mostrarMensagem('Excluindo implantação...', 'info');
        
        // Excluir do Supabase
        await SupabaseService.excluirImplantacao(implantacaoAtual.id);
        
        // Remover da lista local
        const index = implantacoes.findIndex(imp => imp.id === implantacaoAtual.id);
        if (index !== -1) {
            implantacoes.splice(index, 1);
        }
        
        // Recarregar painel e voltar
        carregarPainelProjetos();
        voltarPainelProjetos();
        fecharModalConfirmarExclusao();
        
        mostrarMensagem(`Implantação "${implantacaoAtual.empresa}" excluída com sucesso!`, 'sucesso');
        
    } catch (error) {
        console.error('Erro ao excluir implantação:', error);
        mostrarMensagem('Erro ao excluir implantação. Tente novamente.', 'erro');
    }
}

// Voltar ao painel de projetos
function voltarPainelProjetos() {
    document.getElementById('status-implantacao').classList.add('hidden');
    document.getElementById('painel-projetos').classList.remove('hidden');
    implantacaoAtual = null;
}

// Abrir modal para adicionar nova implantação
function abrirModalAdicionar() {
    document.getElementById('modal-adicionar').classList.remove('hidden');
    document.getElementById('form-adicionar').reset();
}

// Fechar modal
function fecharModal() {
    document.getElementById('modal-adicionar').classList.add('hidden');
}

// Adicionar nova implantação
async function adicionarNovaImplantacao(e) {
    e.preventDefault();
    
    const empresa = document.getElementById('nova-empresa').value;
    const projeto = document.getElementById('novo-projeto').value;
    const sistema = document.getElementById('novo-sistema').value;
    const gestor = document.getElementById('novo-gestor').value;
    const especialista = document.getElementById('especialista').value;
    const logoFile = document.getElementById('logo-cliente').files[0];
    
    try {
        // Processar logo se foi fornecida
        let logoUrl = null;
        if (logoFile) {
            mostrarMensagem('Fazendo upload do logo...', 'info');
            const fileName = `${Date.now()}_${logoFile.name}`;
            logoUrl = await SupabaseService.uploadLogo(logoFile, fileName);
        }
        
        const novaImplantacao = {
            empresa: empresa,
            projeto: projeto,
            sistema: sistema,
            gestor: gestor,
            especialista: especialista,
            logo: logoUrl,
            progresso: 0,
            status: "Não Iniciado",
            statusMeses: {
                janeiro: ["pendente", "pendente", "pendente", "pendente"],
                fevereiro: ["pendente", "pendente", "pendente", "pendente"],
                marco: ["pendente", "pendente", "pendente", "pendente"],
                abril: ["pendente", "pendente", "pendente", "pendente"],
                maio: ["pendente", "pendente", "pendente", "pendente"],
                junho: ["pendente", "pendente", "pendente", "pendente"],
                julho: ["pendente", "pendente", "pendente", "pendente"],
                agosto: ["pendente", "pendente", "pendente", "pendente"],
                setembro: ["pendente", "pendente", "pendente", "pendente"],
                outubro: ["pendente", "pendente", "pendente", "pendente"],
                novembro: ["pendente", "pendente", "pendente", "pendente"],
                dezembro: ["pendente", "pendente", "pendente", "pendente"]
            },
            fases: [
                { nome: "Kick Off", previsto: 1, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Treinamento", previsto: 1, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Cadastros", previsto: 6, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Integrações", previsto: 2, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Testes", previsto: 1, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Validação", previsto: 1, realizado: 0, status: "pendente", inicio: "", fim: "" },
                { nome: "Go Live", previsto: 1, realizado: 0, status: "pendente", inicio: "", fim: "" }
            ],
            resumoOperacional: [
                "Projeto recém-criado.",
                "Aguardando definição de datas e início das atividades."
            ]
        };
        
        mostrarMensagem('Salvando implantação...', 'info');
        
        // Salvar no Supabase
        const implantacaoSalva = await SupabaseService.salvarImplantacao(novaImplantacao);
        
        // Adicionar à lista local
        const implantacaoCompleta = {
            id: implantacaoSalva.id,
            empresa: implantacaoSalva.empresa,
            projeto: implantacaoSalva.projeto,
            sistema: implantacaoSalva.sistema,
            gestor: implantacaoSalva.gestor,
            especialista: implantacaoSalva.especialista,
            logo: implantacaoSalva.logo_url,
            progresso: implantacaoSalva.progresso,
            status: implantacaoSalva.status,
            statusMeses: implantacaoSalva.status_meses,
            fases: implantacaoSalva.fases,
            resumoOperacional: implantacaoSalva.resumo_operacional
        };
        
        implantacoes.push(implantacaoCompleta);
        
        // Definir a implantação recém-adicionada como a implantação atual
        implantacaoAtual = implantacaoCompleta;
        
        // Recarregar painel
        carregarPainelProjetos();
        fecharModal();
        
        // Mostrar mensagem de sucesso
        mostrarMensagem(`Implantação "${empresa}" adicionada com sucesso!`, 'sucesso');
        
    } catch (error) {
        console.error('Erro ao adicionar implantação:', error);
        mostrarMensagem('Erro ao salvar implantação. Tente novamente.', 'erro');
    }
}

// Filtrar implantações
function filtrarImplantacoes() {
    const filtro = document.getElementById('filtro-busca').value.toLowerCase();
    const rows = document.querySelectorAll('#tabela-body tr');
    
    rows.forEach(row => {
        const empresa = row.cells[0].textContent.toLowerCase();
        const projeto = row.cells[1].textContent.toLowerCase();
        const sistema = row.cells[2].textContent.toLowerCase();
        
        const corresponde = empresa.includes(filtro) || 
                           projeto.includes(filtro) || 
                           sistema.includes(filtro);
        
        row.style.display = corresponde ? '' : 'none';
    });
}

// Mostrar mensagem de feedback
function mostrarMensagem(texto, tipo) {
    const mensagem = document.createElement('div');
    mensagem.className = `mensagem mensagem-${tipo}`;
    mensagem.textContent = texto;
    mensagem.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    if (tipo === 'sucesso') {
        mensagem.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    } else if (tipo === 'erro') {
        mensagem.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
    } else if (tipo === 'info') {
        mensagem.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    }
    
    document.body.appendChild(mensagem);
    
    setTimeout(() => {
        mensagem.remove();
    }, 3000);
}

// Adicionar animação CSS para mensagens
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .sem-dados {
        font-size: 14px;
        color: #999;
        font-style: italic;
    }
    
    .projeto-finalizado {
        background-color: #f0f8f0 !important;
        border-left: 4px solid #4CAF50 !important;
    }
    
    .projeto-nao-iniciado {
        background-color: #f8f8f0 !important;
        border-left: 4px solid #FF9800 !important;
    }
    
    .status-finalizado {
        background-color: #4CAF50 !important;
        color: white !important;
    }
    
    .status-nao-iniciado {
        background-color: #FF9800 !important;
        color: white !important;
    }
`;
document.head.appendChild(style);

// Funcionalidades extras
document.addEventListener('keydown', function(e) {
    // Esc para fechar modal
    if (e.key === 'Escape') {
        fecharModal();
    }
    
    // Ctrl+N para nova implantação
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        abrirModalAdicionar();
    }
    
    // Backspace para voltar (quando não estiver em input)
    if (e.key === 'Backspace' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        if (!document.getElementById('status-implantacao').classList.contains('hidden')) {
            voltarPainelProjetos();
        }
    }
});

// Função para atualizar progresso em tempo real quando o campo "realizado" é alterado
function atualizarProgressoEmTempoReal() {
    if (!implantacaoAtual) return;
    
    // Recalcular progresso baseado nos valores atuais dos campos
    let totalPrevisto = 0;
    let totalRealizado = 0;
    
    const fasesItems = document.querySelectorAll('.fase-item');
    fasesItems.forEach((item, index) => {
        const previstoInput = item.querySelector('[data-field="previsto"]');
        const realizadoInput = item.querySelector('[data-field="realizado"]');
        
        if (previstoInput && realizadoInput) {
            totalPrevisto += parseInt(previstoInput.value) || 0;
            totalRealizado += parseInt(realizadoInput.value) || 0;
        }
    });
    
    let novoProgresso = 0;
    if (totalPrevisto > 0) {
        novoProgresso = Math.round((totalRealizado / totalPrevisto) * 100);
    }
    
    // Aplicar regras especiais de progresso
    if (temGoLiveConcluido(implantacaoAtual)) {
        novoProgresso = 100;
    } else if (getDataKickOff(implantacaoAtual) && !temKickOffConcluido(implantacaoAtual)) {
        novoProgresso = 0;
    }
    
    // Atualizar a barra de progresso na tela de status se estiver visível
    if (!document.getElementById('status-implantacao').classList.contains('hidden')) {
        atualizarBarraProgresso(novoProgresso);
    }
    
    // Mostrar feedback visual
    mostrarMensagem(`Progresso atualizado: ${novoProgresso}%`, 'info');
}

// Função para adicionar nova observação
async function adicionarNovaObservacao() {
    if (!implantacaoAtual) return;
    
    // Verificar se projeto está finalizado
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível adicionar observações a um projeto finalizado!', 'erro');
        return;
    }
    
    const novaObservacao = "Nova observação";
    implantacaoAtual.resumoOperacional.push(novaObservacao);
    
    try {
        // Salvar no Supabase
        await SupabaseService.atualizarImplantacao(implantacaoAtual.id, implantacaoAtual);
        
        // Atualizar na lista local
        const indexImplantacao = implantacoes.findIndex(imp => imp.id === implantacaoAtual.id);
        if (indexImplantacao !== -1) {
            implantacoes[indexImplantacao] = { ...implantacaoAtual };
        }
        
        // Recarregar o resumo para mostrar a nova observação
        preencherResumoStatus(implantacaoAtual);
        
        mostrarMensagem('Nova observação adicionada! Clique nela para editar.', 'sucesso');
    } catch (error) {
        console.error('Erro ao adicionar observação:', error);
        mostrarMensagem('Erro ao adicionar observação. Tente novamente.', 'erro');
        // Remover a observação da lista se houve erro
        implantacaoAtual.resumoOperacional.pop();
    }
}

// Função para remover observação
async function removerObservacao(index) {
    if (!implantacaoAtual || index < 0 || index >= implantacaoAtual.resumoOperacional.length) return;
    
    // Verificar se projeto está finalizado
    if (temGoLiveConcluido(implantacaoAtual)) {
        mostrarMensagem('Não é possível remover observações de um projeto finalizado!', 'erro');
        return;
    }
    
    if (implantacaoAtual.resumoOperacional.length <= 1) {
        mostrarMensagem('Deve haver pelo menos uma observação!', 'erro');
        return;
    }
    
    if (confirm('Tem certeza que deseja remover esta observação?')) {
        const observacaoRemovida = implantacaoAtual.resumoOperacional[index];
        implantacaoAtual.resumoOperacional.splice(index, 1);
        
        try {
            // Salvar no Supabase
            await SupabaseService.atualizarImplantacao(implantacaoAtual.id, implantacaoAtual);
            
            // Atualizar na lista local
            const indexImplantacao = implantacoes.findIndex(imp => imp.id === implantacaoAtual.id);
            if (indexImplantacao !== -1) {
                implantacoes[indexImplantacao] = { ...implantacaoAtual };
            }
            
            // Recarregar o resumo
            preencherResumoStatus(implantacaoAtual);
            
            mostrarMensagem('Observação removida com sucesso!', 'sucesso');
        } catch (error) {
            console.error('Erro ao remover observação:', error);
            mostrarMensagem('Erro ao remover observação. Tente novamente.', 'erro');
            // Restaurar a observação se houve erro
            implantacaoAtual.resumoOperacional.splice(index, 0, observacaoRemovida);
        }
    }
}

