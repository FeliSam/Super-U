import 'react-native-gesture-handler';
import 'expo';
import './lib/launchGuards';
import './lib/bootstrap';
// Tâche GPS arrière-plan : doit être déclarée avant le routeur (relance « sans écran » sur Android).
import './lib/backgroundLocation';
import 'expo-router/entry';
