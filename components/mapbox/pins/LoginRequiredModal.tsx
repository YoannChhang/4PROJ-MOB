import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

interface LoginRequiredModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToLogin: () => void;
}

const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  visible,
  onClose,
  onNavigateToLogin,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Connexion Requise</Text>
                <TouchableOpacity onPress={onClose}>
                  <FontAwesome5 name="times" size={20} color="#555" />
                </TouchableOpacity>
              </View>

              <View style={styles.iconContainer}>
                <FontAwesome5 name="user-lock" size={48} color="#4285F4" />
              </View>

              <Text style={styles.messageText}>
                Vous devez être connecté(e) pour signaler des incidents.
                Connectez-vous pour aider les autres utilisateurs en signalant
                l'état des routes.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={onNavigateToLogin}
                >
                  <FontAwesome5 name="sign-in-alt" size={16} color="#fff" />
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "80%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  messageText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loginButton: {
    flexDirection: "row",
    backgroundColor: "#4285F4",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginRight: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  cancelButtonText: {
    color: "#333",
  },
});

export default LoginRequiredModal;
