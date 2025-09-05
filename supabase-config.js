// Configuração do Supabase
const SUPABASE_URL = 'https://obwgegvrtxrlombmkaej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9id2dlZ3ZydHhybG9tYm1rYWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDcxOTMsImV4cCI6MjA2NDAyMzE5M30.0Ng21Ywqrm6eDqbclFyeOhARpJCyWvX7b-0dJLE1QwM';

// Verificar se o Supabase está disponível
if (typeof supabase === 'undefined') {
    console.error('Supabase não está carregado. Verifique se o script está incluído.');
}

// Inicializar cliente Supabase
let supabaseClient = null;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Cliente Supabase inicializado com sucesso');
} catch (error) {
    console.error('Erro ao inicializar cliente Supabase:', error);
}

// Funções para interagir com o Supabase
class SupabaseService {
    
    // Carregar todas as implantações
    static async carregarImplantacoes() {
        try {
            if (!supabaseClient) {
                throw new Error('Cliente Supabase não inicializado');
            }
            
            const { data, error } = await supabaseClient
                .from('painel_implantacoes')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Erro ao carregar implantações:', error);
                return [];
            }
            
            return data || [];
        } catch (error) {
            console.error('Erro na conexão com Supabase:', error);
            return [];
        }
    }
    
    // Salvar nova implantação
    static async salvarImplantacao(implantacao) {
        try {
            if (!supabaseClient) {
                throw new Error('Cliente Supabase não inicializado');
            }
            
            const { data, error } = await supabaseClient
                .from('painel_implantacoes')
                .insert([{
                    empresa: implantacao.empresa,
                    projeto: implantacao.projeto,
                    sistema: implantacao.sistema,
                    gestor: implantacao.gestor,
                    especialista: implantacao.especialista,
                    logo_url: implantacao.logo,
                    progresso: implantacao.progresso,
                    status: implantacao.status,
                    status_meses: implantacao.statusMeses,
                    fases: implantacao.fases,
                    resumo_operacional: implantacao.resumoOperacional
                }])
                .select();
            
            if (error) {
                console.error('Erro ao salvar implantação:', error);
                throw error;
            }
            
            return data[0];
        } catch (error) {
            console.error('Erro ao salvar implantação:', error);
            throw error;
        }
    }
    
    // Atualizar implantação existente
    static async atualizarImplantacao(id, implantacao) {
        try {
            if (!supabaseClient) {
                throw new Error('Cliente Supabase não inicializado');
            }
            
            const { data, error } = await supabaseClient
                .from('painel_implantacoes')
                .update({
                    empresa: implantacao.empresa,
                    projeto: implantacao.projeto,
                    sistema: implantacao.sistema,
                    gestor: implantacao.gestor,
                    especialista: implantacao.especialista,
                    logo_url: implantacao.logo,
                    progresso: implantacao.progresso,
                    status: implantacao.status,
                    status_meses: implantacao.statusMeses,
                    fases: implantacao.fases,
                    resumo_operacional: implantacao.resumoOperacional,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            
            if (error) {
                console.error('Erro ao atualizar implantação:', error);
                throw error;
            }
            
            return data[0];
        } catch (error) {
            console.error('Erro ao atualizar implantação:', error);
            throw error;
        }
    }
    
    // Excluir implantação
    static async excluirImplantacao(id) {
        try {
            if (!supabaseClient) {
                throw new Error('Cliente Supabase não inicializado');
            }
            
            const { error } = await supabaseClient
                .from('painel_implantacoes')
                .delete()
                .eq('id', id);
            
            if (error) {
                console.error('Erro ao excluir implantação:', error);
                throw error;
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao excluir implantação:', error);
            throw error;
        }
    }
    
    // Upload de ficheiro (logo)
    static async uploadLogo(file, fileName) {
        try {
            if (!supabaseClient) {
                throw new Error('Cliente Supabase não inicializado');
            }
            
            const { data, error } = await supabaseClient.storage
                .from('logos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            
            if (error) {
                console.error('Erro ao fazer upload do logo:', error);
                throw error;
            }
            
            // Obter URL pública do ficheiro
            const { data: publicData } = supabaseClient.storage
                .from('logos')
                .getPublicUrl(fileName);
            
            return publicData.publicUrl;
        } catch (error) {
            console.error('Erro no upload do logo:', error);
            throw error;
        }
    }
    
    // Verificar conexão com Supabase
    static async verificarConexao() {
        try {
            if (!supabaseClient) {
                console.error('Cliente Supabase não inicializado');
                return false;
            }
            
            const { data, error } = await supabaseClient
                .from('painel_implantacoes')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                console.error('Erro na verificação de conexão:', error);
                return false;
            }
            
            console.log('Conexão com Supabase estabelecida com sucesso');
            return true;
        } catch (error) {
            console.error('Erro na conexão com Supabase:', error);
            return false;
        }
    }
}

// Exportar para uso global
window.SupabaseService = SupabaseService;

