"""
Surveillance des fichiers de logs en continu (equivalent d'un "tail -f").

On utilise watchdog pour etre notifie immediatement quand un fichier est
modifie, plutot que de boucler en relisant le fichier toutes les X
secondes (ce qui gaspillerait du CPU pour rien).
"""

import os
from typing import Callable

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class GestionnaireFichier(FileSystemEventHandler):
    """Reagit a chaque modification d'un fichier de log surveille."""

    def __init__(self, chemin_fichier: str, callback: Callable[[str], None]):
        self.chemin_fichier = os.path.abspath(chemin_fichier)
        self.callback = callback
        self.position = self._position_initiale()

    def _position_initiale(self) -> int:
        """Se place a la fin du fichier : on ne traite que les NOUVELLES lignes."""
        if not os.path.exists(self.chemin_fichier):
            return 0
        return os.path.getsize(self.chemin_fichier)

    def on_modified(self, event):
        if os.path.abspath(event.src_path) != self.chemin_fichier:
            return  # Watchdog notifie pour tout le dossier, on filtre.

        with open(self.chemin_fichier, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(self.position)
            nouvelles_lignes = f.readlines()
            self.position = f.tell()

        for ligne in nouvelles_lignes:
            ligne = ligne.strip()
            if ligne:
                self.callback(ligne)


def surveiller_fichiers(fichiers_et_callbacks: list[tuple[str, Callable[[str], None]]]) -> Observer:
    """Demarre la surveillance de plusieurs fichiers et renvoie l'Observer.

    fichiers_et_callbacks : liste de tuples (chemin_fichier, callback)
    """
    observer = Observer()

    for chemin_fichier, callback in fichiers_et_callbacks:
        gestionnaire = GestionnaireFichier(chemin_fichier, callback)
        dossier = os.path.dirname(chemin_fichier) or "."
        observer.schedule(gestionnaire, path=dossier, recursive=False)

    observer.start()
    return observer
