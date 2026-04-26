/**
 * NetInsight 360 - Page Sécurité
 *
 * Orchestration du workflow 2FA côté utilisateur:
 * - lecture de l'état courant
 * - préparation d'un secret TOTP
 * - confirmation avec code applicatif
 * - régénération des recovery codes
 * - désactivation contrôlée
 */

document.addEventListener('DOMContentLoaded', () => {
    const statusBadge = document.getElementById('twoFactorStatusBadge');
    const recoveryRemaining = document.getElementById('recoveryCodesRemaining');
    const confirmedAt = document.getElementById('twoFactorConfirmedAt');
    const prepareBtn = document.getElementById('prepareTwoFactorBtn');
    const confirmBtn = document.getElementById('confirmTwoFactorBtn');
    const disableBtn = document.getElementById('disableTwoFactorBtn');
    const regenerateBtn = document.getElementById('regenerateRecoveryCodesBtn');
    const setupResult = document.getElementById('setupResult');
    const qrWrapper = document.getElementById('twoFactorQrWrapper');
    const secretEl = document.getElementById('twoFactorSecret');
    const recoveryCodesOutput = document.getElementById('recoveryCodesOutput');

    function renderRecoveryCodes(codes = []) {
        recoveryCodesOutput.innerHTML = codes.map((code) => `<div class="security-code-item">${code}</div>`).join('');
    }

    function setStatus(enabled, recoveryCount = 0, confirmed = null) {
        statusBadge.className = `status-pill ${enabled ? 'status-enabled' : 'status-disabled'}`;
        statusBadge.innerHTML = enabled
            ? '<i class="bi bi-shield-check"></i> 2FA actif'
            : '<i class="bi bi-shield-x"></i> 2FA désactivé';

        recoveryRemaining.textContent = String(recoveryCount);
        confirmedAt.textContent = confirmed ? new Date(confirmed).toLocaleString('fr-FR') : 'Jamais';
    }

    async function refreshStatus() {
        try {
            const result = await API.getTwoFactorStatus();
            const data = result.data || {};
            setStatus(Boolean(data.enabled), Number(data.recovery_codes_remaining || 0), data.confirmed_at || null);
        } catch (error) {
            console.error('[Security] Erreur statut 2FA:', error);
        }
    }

    prepareBtn?.addEventListener('click', async () => {
        const currentPassword = document.getElementById('setupCurrentPassword').value;
        if (!currentPassword) {
            alert('Veuillez saisir votre mot de passe actuel.');
            return;
        }

        prepareBtn.disabled = true;
        try {
            const result = await API.setupTwoFactor(currentPassword);
            setupResult.style.display = 'block';
            qrWrapper.innerHTML = result.data.qr_svg;
            secretEl.textContent = result.data.secret;
        } catch (error) {
            alert(error.message || 'Impossible de préparer le 2FA.');
        } finally {
            prepareBtn.disabled = false;
        }
    });

    confirmBtn?.addEventListener('click', async () => {
        const code = document.getElementById('confirmTwoFactorCode').value.trim();
        if (!code) {
            alert('Veuillez saisir le code de votre application.');
            return;
        }

        confirmBtn.disabled = true;
        try {
            const result = await API.confirmTwoFactor(code);
            renderRecoveryCodes(result.data?.recovery_codes || []);
            await refreshStatus();
            alert('Le 2FA TOTP est maintenant actif. Conservez vos codes de secours.');
        } catch (error) {
            alert(error.message || 'Activation du 2FA impossible.');
        } finally {
            confirmBtn.disabled = false;
        }
    });

    regenerateBtn?.addEventListener('click', async () => {
        const currentPassword = document.getElementById('regenerateCurrentPassword').value;
        const code = document.getElementById('regenerateTwoFactorCode').value.trim();
        if (!currentPassword || !code) {
            alert('Veuillez saisir le mot de passe actuel et un code valide.');
            return;
        }

        regenerateBtn.disabled = true;
        try {
            const result = await API.regenerateTwoFactorRecoveryCodes(currentPassword, code);
            renderRecoveryCodes(result.data?.recovery_codes || []);
            await refreshStatus();
            alert('Les nouveaux codes de secours ont été générés.');
        } catch (error) {
            alert(error.message || 'Régénération impossible.');
        } finally {
            regenerateBtn.disabled = false;
        }
    });

    disableBtn?.addEventListener('click', async () => {
        const currentPassword = document.getElementById('disableCurrentPassword').value;
        const code = document.getElementById('disableTwoFactorCode').value.trim();
        if (!currentPassword || !code) {
            alert('Veuillez saisir le mot de passe actuel et un code valide.');
            return;
        }

        if (!confirm('Confirmez-vous la désactivation du 2FA ?')) {
            return;
        }

        disableBtn.disabled = true;
        try {
            await API.disableTwoFactor(currentPassword, code);
            renderRecoveryCodes([]);
            setupResult.style.display = 'none';
            secretEl.textContent = '';
            qrWrapper.innerHTML = '';
            await refreshStatus();
            alert('Le 2FA a été désactivé.');
        } catch (error) {
            alert(error.message || 'Désactivation impossible.');
        } finally {
            disableBtn.disabled = false;
        }
    });

    refreshStatus();
});