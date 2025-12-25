
# Multas Rápidas - Guia de Configuração Firebase

Este aplicativo utiliza Firebase Firestore para banco de dados em tempo real e persistência offline.

## 🛠 Configuração no Console do Firebase

### 1. Firestore Database
- Ative o **Firestore Database** no menu "Criação".
- Vá na aba **Regras** e utilize:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```
  *(Atenção: Use estas regras apenas para desenvolvimento. Para produção, restrinja o acesso).*

### 2. Obter Credenciais
- Vá em **Configurações do Projeto** -> **Seus aplicativos**.
- Adicione um aplicativo **Web (</>)**.
- Copie o objeto `firebaseConfig` para o arquivo `firebase.ts`.

## 📦 Estrutura de Dados (Automática)
O app criará automaticamente estas coleções no primeiro acesso:
- `infractions`: Armazena a base de dados de multas.
- `stats`: Documento `global` com o campo `accessCount`.
- `audit_logs`: Registros de alterações feitas por gestores.

## 👤 Perfis de Teste
- **Agente:** Qualquer e-mail.
- **Gestor:** E-mail contendo a palavra `admin` (ex: `chefe@admin.com`).

---
*Desenvolvido para Agentes de Fiscalização de Trânsito.*
